const { App, ExpressReceiver } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 공통 모듈
const { sendDM, sendEphemeral, fetchMessage } = require('./lib/slack');
const {
    DEFAULT_DAILY_AVOCADOS,
    countAvocados,
    extractMentions,
    parseAvocadoMessage,
    getRemainingAvocados,
    canDistribute,
    excludeSender,
    buildSenderSuccessMessage,
    buildErrorMessage,
    executeTransfers,
} = require('./lib/avocado');

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

// 아보카도 감지 (메시지 기반)
app.message(/:avocado:|🥑/, async ({ message, client }) => {
    const parsed = parseAvocadoMessage(message);
    if (!parsed) return;

    const { sender, receiverIds: allReceiverIds, avocadoCount } = parsed;
    const { filtered: receiverIds, selfIncluded } = excludeSender(allReceiverIds, sender);

    // 자기 자신에게만 보낸 경우
    if (receiverIds.length === 0) {
        await sendEphemeral(client, message.channel, sender, buildErrorMessage('self_only'));
        return;
    }

    // 잔여 개수 확인
    const remaining = await getRemainingAvocados(supabase, sender);

    if (remaining <= 0) {
        await sendEphemeral(client, message.channel, sender, buildErrorMessage('no_remaining'));
        return;
    }

    // All-or-nothing: 부족하면 아무에게도 보내지 않음
    if (!canDistribute(receiverIds, avocadoCount, remaining)) {
        const totalNeeded = avocadoCount * receiverIds.length;
        await sendEphemeral(
            client,
            message.channel,
            sender,
            buildErrorMessage('insufficient', { remaining, totalNeeded, receiverCount: receiverIds.length })
        );
        return;
    }

    const { successList } = await executeTransfers({
        supabase,
        slackClient: client,
        senderId: sender,
        receiverIds,
        avocadoCount,
        context: {
            type: 'message',
            channelId: message.channel,
            messageText: message.text,
        },
    });

    // 결과 DM 전송
    if (successList.length > 0) {
        const remainingAfter = await getRemainingAvocados(supabase, sender);
        const resultMessage = buildSenderSuccessMessage({ successList, remainingAfter, selfIncluded });
        if (resultMessage) {
            await sendDM(client, sender, resultMessage);
        }
    }
});

// 리액션 기반 아보카도 전송
app.event('reaction_added', async ({ event, client }) => {
    // avocado 리액션만 처리
    if (event.reaction !== 'avocado') return;

    const senderId = event.user;
    const channelId = event.item.channel;
    const messageTs = event.item.ts;

    // 원본 메시지 조회
    let originalMessage;
    try {
        originalMessage = await fetchMessage(client, channelId, messageTs);
    } catch (error) {
        // 메시지 조회 실패 시 조용히 종료 (권한 문제 등)
        return;
    }

    if (!originalMessage) return;

    const messageAuthor = originalMessage.user;
    const messageText = originalMessage.text || '';

    // 자기 메시지에 리액션한 경우
    if (senderId === messageAuthor) {
        await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'));
        return;
    }

    // 수신자 결정: 메시지에 멘션된 사람들이 있으면 그들에게, 없으면 메시지 작성자에게
    const mentionedUsers = extractMentions(messageText);
    const { filtered: receiverIds, selfIncluded } = excludeSender(
        mentionedUsers.length > 0 ? mentionedUsers : [messageAuthor],
        senderId
    );

    if (receiverIds.length === 0) {
        await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'));
        return;
    }

    // 잔여 개수 확인
    const remaining = await getRemainingAvocados(supabase, senderId);

    if (remaining <= 0) {
        await sendEphemeral(client, channelId, senderId, buildErrorMessage('no_remaining'));
        return;
    }

    const avocadoCount = 1; // 리액션은 항상 1개

    if (!canDistribute(receiverIds, avocadoCount, remaining)) {
        const totalNeeded = avocadoCount * receiverIds.length;
        await sendEphemeral(
            client,
            channelId,
            senderId,
            buildErrorMessage('insufficient', { remaining, totalNeeded, receiverCount: receiverIds.length })
        );
        return;
    }

    const { successList } = await executeTransfers({
        supabase,
        slackClient: client,
        senderId,
        receiverIds,
        avocadoCount,
        context: {
            type: 'reaction',
            channelId,
            messageText,
        },
    });

    // 결과 DM 전송
    if (successList.length > 0) {
        const remainingAfter = await getRemainingAvocados(supabase, senderId);
        const resultMessage = buildSenderSuccessMessage({ successList, remainingAfter, selfIncluded });
        if (resultMessage) {
            await sendDM(client, senderId, resultMessage);
        }
    }
});

// 칭호 계산 (받은 사람)
function getTitle(receivedCount) {
    if (receivedCount >= 500) return 'Holy Guacamole 👑';
    if (receivedCount >= 250) return 'Certified Fresh ✨';
    if (receivedCount >= 100) return 'Big Avo Energy 🌳';
    if (receivedCount >= 50) return 'Warming Up ☀️';
    if (receivedCount >= 10) return 'Just Watered 💧';
    return 'Seed Mode 🌱';
}

// 칭호 계산 (준 사람)
function getGiverTitle(givenCount) {
    if (givenCount >= 500) return 'Master Farmer 👨‍🌾';
    if (givenCount >= 250) return 'Harvest Machine 🚜';
    if (givenCount >= 100) return 'Tree Hugger 🌳';
    if (givenCount >= 50) return 'Green Thumb 🪴';
    if (givenCount >= 10) return 'First Rain 🌧️';
    return 'Dirt Digger ⛏️';
}

// Home Tab
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
    const giverTitle = getGiverTitle(given);
    const receiverTitle = getTitle(received);
    const leaders = leaderboardResult.data || [];
    const givers = giversResult.data || [];

    // Leaderboard 블록 생성
    const leaderboardBlocks = leaders.map((u, i) => {
        const userTitle = getTitle(u.received_count);
        return {
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: `*${i + 1}.*` },
                { type: 'mrkdwn', text: `<@${u.id}>` },
                { type: 'mrkdwn', text: `*${u.received_count}*` },
                { type: 'mrkdwn', text: `\`${userTitle}\`` },
            ],
        };
    });

    // Top Givers 블록 생성
    const giversBlocks = givers.map((u, i) => {
        const giverTitle = getGiverTitle(u.given_count);
        return {
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: `*${i + 1}.*` },
                { type: 'mrkdwn', text: `<@${u.id}>` },
                { type: 'mrkdwn', text: `*${u.given_count}*` },
                { type: 'mrkdwn', text: `\`${giverTitle}\`` },
            ],
        };
    });

    await client.views.publish({
        user_id: userId,
        view: {
            type: 'home',
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'My Avo Stats 🥑', emoji: true },
                },
                { type: 'divider' },
                {
                    type: 'context',
                    elements: [
                        { type: 'mrkdwn', text: 'Given' },
                        { type: 'mrkdwn', text: `*${given}*` },
                        { type: 'mrkdwn', text: `\`${giverTitle}\`` },
                    ],
                },
                {
                    type: 'context',
                    elements: [
                        { type: 'mrkdwn', text: 'Received' },
                        { type: 'mrkdwn', text: `*${received}*` },
                        { type: 'mrkdwn', text: `\`${receiverTitle}\`` },
                    ],
                },
                {
                    type: 'context',
                    elements: [
                        { type: 'mrkdwn', text: 'Avos left to give today' },
                        { type: 'mrkdwn', text: `*${remaining}*` },
                    ],
                },

                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'Top Avo Givers 🫴', emoji: true },
                },
                { type: 'divider' },
                ...giversBlocks,

                {
                    type: 'header',
                    text: { type: 'plain_text', text: 'Top Avo Receivers 🧺', emoji: true },
                },
                { type: 'divider' },
                ...leaderboardBlocks,

                { type: 'context', elements: [{ type: 'mrkdwn', text: ' ' }] },
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
