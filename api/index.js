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
    const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    return formatter.format(receiverIds.map(id => `<@${id}>`));
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

// 칭호 계산 (받은 사람)
function getTitle(receivedCount) {
    if (receivedCount >= 500) return '👑 Holy Guacamole';
    if (receivedCount >= 250) return '✨ Certified Fresh';
    if (receivedCount >= 100) return '🌳 Big Avo Energy';
    if (receivedCount >= 50) return '☀️ Warming Up';
    if (receivedCount >= 10) return '💧 Just Watered';
    return '🌱 Seed Mode';
}

// 칭호 계산 (준 사람)
function getGiverTitle(givenCount) {
    if (givenCount >= 500) return '👨‍🌾 Master Farmer';
    if (givenCount >= 250) return '🚜 Harvest Machine';
    if (givenCount >= 100) return '🌳 Tree Hugger';
    if (givenCount >= 50) return '🪴 Green Thumb';
    if (givenCount >= 10) return '🌧️ First Rain';
    return '🌰 Dirt Digger';
}

// 🏠 Home Tab
app.event('app_home_opened', async ({ event, client }) => {
    const userId = event.user;

    const [profileResult, leaderboardResult, giversResult] = await Promise.all([
        supabase.from('profiles').select('given_count, received_count, remaining_daily').eq('id', userId).single(),
        supabase.from('profiles').select('id, received_count').order('received_count', { ascending: false }).limit(10),
        supabase.from('profiles').select('id, given_count').order('given_count', { ascending: false }).limit(10),
    ]);

    const given = profileResult.data?.given_count ?? 0;
    const received = profileResult.data?.received_count ?? 0;
    const remaining = profileResult.data?.remaining_daily ?? DEFAULT_DAILY_AVOCADOS;
    const title = getTitle(received);
    const leaders = leaderboardResult.data || [];
    const givers = giversResult.data || [];

    // Leaderboard 블록 생성
    const leaderboardBlocks = leaders.map((u, i) => {
        const rank = `${i + 1}.`;
        const userTitle = getTitle(u.received_count);
        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${rank} <@${u.id}> · *${u.received_count}* · ${userTitle}`,
            },
        };
    });

    // Top Givers 블록 생성
    const giversBlocks = givers.map((u, i) => {
        const rank = `${i + 1}.`;
        const giverTitle = getGiverTitle(u.given_count);
        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${rank} <@${u.id}> · *${u.given_count}* · ${giverTitle}`,
            },
        };
    });

    await client.views.publish({
        user_id: userId,
        view: {
            type: 'home',
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'My Avo Stats', emoji: true },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `My Title: *${title}*\n🫴 Given: *${given}* | 🧺 Received: *${received}*\nAvos left to give today: *${remaining}*`,
                    },
                },
                { type: 'divider' },
                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'Top Avo Givers', emoji: true },
                },
                ...giversBlocks,
                { type: 'divider' },
                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'Top Avo Receivers', emoji: true },
                },
                ...leaderboardBlocks,
                { type: 'divider' },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: '💡 *Tip:* Mention a teammate with 🥑 to spread the good vibes!',
                        },
                    ],
                },
            ],
        },
    });
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
