const { App, ExpressReceiver } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 상수 정의
const DEFAULT_DAILY_AVOCADOS = 5;

// 환경 변수 로드
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    processBeforeResponse: true,
});

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver,
});

// 아보카도 이모지 카운트 함수
function countAvocados(text) {
    const emojiMatches = text.match(/🥑/g) || [];
    const slackMatches = text.match(/:avocado:/g) || [];
    return emojiMatches.length + slackMatches.length;
}

// DM 전송 함수
async function sendDM(userId, text) {
    return app.client.chat.postMessage({ channel: userId, text });
}

// 메시지 파싱 함수
function parseAvocadoMessage(message) {
    if (message.subtype || message.bot_id) return null;

    const sender = message.user;
    const matches = message.text.match(/<@([A-Z0-9]+)>/g);
    if (!matches) return null;

    const avocadoCount = countAvocados(message.text);
    if (avocadoCount === 0) return null;

    const allReceiverIds = [...new Set(matches.map(m => m.replace(/[<@>]/g, '')))];
    const selfIncluded = allReceiverIds.includes(sender);
    const receiverIds = allReceiverIds.filter(id => id !== sender);

    return { sender, receiverIds, avocadoCount, selfIncluded };
}

// 아보카도 분배 가능 여부 확인 (all-or-nothing)
function canDistribute(receiverIds, avocadoCount, remaining) {
    const totalNeeded = avocadoCount * receiverIds.length;
    return totalNeeded <= remaining;
}

// 수신자 목록 포맷팅 (Oxford comma)
function formatRecipientList(receiverIds) {
    if (receiverIds.length === 1) return `<@${receiverIds[0]}>`;
    if (receiverIds.length === 2) return `<@${receiverIds[0]}> and <@${receiverIds[1]}>`;
    const last = receiverIds[receiverIds.length - 1];
    const rest = receiverIds.slice(0, -1).map(id => `<@${id}>`).join(', ');
    return `${rest}, and <@${last}>`;
}

// 결과 메시지 생성 (순수 함수)
function buildResultMessage(successList, failedList, remainingAfter, selfIncluded) {
    if (successList.length === 0) return null;

    const avocadoCount = successList[0].count;
    const countPlural = avocadoCount > 1 ? 's' : '';
    const remainPlural = remainingAfter !== 1 ? 's' : '';
    const recipientList = formatRecipientList(successList.map(s => s.receiverId));

    let msg = `${recipientList} received *${avocadoCount} avo${countPlural}* from you. You have *${remainingAfter} avo${remainPlural}* left to give out today.`;

    if (selfIncluded) {
        msg += `\n(I skipped you, because you can't give avos to yourself!)`;
    }

    return msg;
}

// 아보카도 전송 처리 (DB 저장 + 수신자 DM)
async function processAvocadoTransfers(distribution, sender, message) {
    const successList = [];
    const failedList = [];

    for (const { receiverId, count } of distribution) {
        if (count === 0) {
            failedList.push(receiverId);
            continue;
        }

        const { error } = await supabase.rpc('give_avocado', {
            sender_id_input: sender,
            receiver_id_input: receiverId,
            count: count,
            message_text: message.text,
            channel_id_input: message.channel
        });

        if (!error) {
            successList.push({ receiverId, count });
            await sendDM(receiverId, `You received *${count} avo${count > 1 ? 's' : ''}* from <@${sender}> in <#${message.channel}>.\n> ${message.text}`);
        } else {
            failedList.push(receiverId);
        }
    }

    return { successList, failedList };
}

// 아보카도 감지
app.message(/:avocado:|🥑/, async ({ message }) => {
    const parsed = parseAvocadoMessage(message);
    if (!parsed) return;

    const { sender, receiverIds, avocadoCount, selfIncluded } = parsed;

    // 자기 자신에게만 보낸 경우
    if (receiverIds.length === 0) {
        await sendDM(sender, `We love self-care, but avos are for sharing! 🥑 You can't give them to yourself.`);
        return;
    }

    // 잔여 개수 확인
    const { data: user } = await supabase.from('profiles').select('remaining_daily').eq('id', sender).single();
    const remaining = user ? user.remaining_daily : DEFAULT_DAILY_AVOCADOS;

    if (remaining <= 0) {
        await sendDM(sender, `You're too generous! You've used up your daily supply. You have *0 avos* left. Come back tomorrow to spread more love. 💚`);
        return;
    }

    // All-or-nothing: 부족하면 아무에게도 보내지 않음
    if (!canDistribute(receiverIds, avocadoCount, remaining)) {
        const totalNeeded = avocadoCount * receiverIds.length;
        const plural = remaining !== 1 ? 's' : '';
        await sendDM(sender, `You tried to give *${totalNeeded} avo${totalNeeded > 1 ? 's' : ''}* to ${receiverIds.length} people, but you only have *${remaining} avo${plural}* left. No avos were sent. You have *${remaining} avo${plural}* left to give out today.`);
        return;
    }

    const distribution = receiverIds.map(id => ({ receiverId: id, count: avocadoCount }));
    const { successList, failedList } = await processAvocadoTransfers(distribution, sender, message);

    // 결과 DM 전송
    if (successList.length > 0) {
        const { data: updatedUser } = await supabase
            .from('profiles')
            .select('remaining_daily')
            .eq('id', sender)
            .single();
        const remainingAfter = updatedUser ? updatedUser.remaining_daily : 0;

        const resultMessage = buildResultMessage(successList, failedList, remainingAfter, selfIncluded);
        if (resultMessage) {
            await sendDM(sender, resultMessage);
        }
    }
});

// 🏆 리더보드
app.command('/avo-leaderboard', async ({ ack, respond }) => {
    await ack();
    const { data: leaders } = await supabase.from('profiles').select('id, received_count').order('received_count', { ascending: false }).limit(5);

    let msg = "*🏆 명예의 전당*\n";
    leaders?.forEach((u, i) => msg += `${i+1}위 <@${u.id}>: ${u.received_count} 🥑\n`);
    await respond(msg);
});

module.exports = async (req, res) => {
    // Body가 문자열인 경우 파싱
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
            req.body = body;
        } catch (e) {
            // JSON 파싱 실패 시 무시
        }
    }

    // 슬랙의 URL 검증(Challenge) 요청 처리
    if (body && body.type === 'url_verification') {
        return res.status(200).json({ challenge: body.challenge });
    }

    // POST 요청: Bolt로 처리
    if (req.method === 'POST') {
        if (!req.rawBody && req.body) {
            req.rawBody = Buffer.from(JSON.stringify(req.body));
        }
        await receiver.requestHandler(req, res);
    } else {
        res.status(200).send('Bravocado is running! 🥑');
    }
};
