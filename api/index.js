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

// 결과 메시지 생성 (순수 함수)
function buildResultMessage(successList, failedList, remainingAfter) {
    let resultMessage = '';

    if (successList.length > 0) {
        resultMessage = `Bravocado! 🥑 아보카도를 보냈어요!\n`;
        for (const { receiverId, count } of successList) {
            resultMessage += `<@${receiverId}>님에게 ${count}개\n`;
        }
    }

    if (failedList.length > 0) {
        if (resultMessage) resultMessage += '\n';
        resultMessage += `오늘 아보카도를 다 써서 `;
        resultMessage += failedList.map(id => `<@${id}>`).join(', ');
        resultMessage += `님에게는 보내지 못했어요.`;
    }

    if (!resultMessage) return null;

    const remainingText = remainingAfter > 0
        ? `오늘 남은 아보카도: ${remainingAfter}개`
        : `오늘 아보카도를 모두 나눠줬어요! 내일 또 만나요.`;

    return `${resultMessage}\n${remainingText}`;
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
            await sendDM(receiverId, `<@${sender}>님이 아보카도 ${count}개를 보냈어요! 🥑\n💬 ${message.text}`);
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
        await sendDM(sender, `자신에게는 보낼 수 없어요!`);
        return;
    }

    // 잔여 개수 확인
    const { data: user } = await supabase.from('profiles').select('remaining_daily').eq('id', sender).single();
    const remaining = user ? user.remaining_daily : DEFAULT_DAILY_AVOCADOS;

    if (remaining <= 0) {
        await sendDM(sender, `오늘 수확한 아보카도가 다 떨어졌어요! 🥑 내일 만나요.`);
        return;
    }

    // All-or-nothing: 부족하면 아무에게도 보내지 않음
    if (!canDistribute(receiverIds, avocadoCount, remaining)) {
        const totalNeeded = avocadoCount * receiverIds.length;
        const plural = remaining !== 1 ? 's' : '';
        await sendDM(sender, `You tried to give ${totalNeeded} 🥑${totalNeeded > 1 ? 's' : ''} to ${receiverIds.length} people, but you only have ${remaining} 🥑${plural} left. No avocados were sent. You have ${remaining} 🥑${plural} left to give out today.`);
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

        const resultMessage = buildResultMessage(successList, failedList, remainingAfter);
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
