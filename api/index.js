const { App, ExpressReceiver } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

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

// 아보카도 감지
app.message(/:avocado:|🥑/, async ({ message }) => {
    if (message.subtype || message.bot_id) return; // 봇 무시

    const sender = message.user;
    const matches = message.text.match(/<@([A-Z0-9]+)>/g); // 멘션 추출
    if (!matches) return;

    // 아보카도 개수 카운트
    const avocadoCount = countAvocados(message.text);
    if (avocadoCount === 0) return;

    // 자기 자신 제외한 수신자 목록
    const receiverIds = [...new Set(matches.map(m => m.replace(/[<@>]/g, '')))]
        .filter(id => id !== sender);

    // 자기 자신에게만 보낸 경우
    if (receiverIds.length === 0) {
        await app.client.chat.postMessage({
            channel: sender,
            text: `자신에게는 보낼 수 없어요!`
        });
        return;
    }

    // 잔여 개수 확인 (루프 밖에서 한 번만)
    const { data: user } = await supabase.from('profiles').select('remaining_daily').eq('id', sender).single();
    const remaining = user ? user.remaining_daily : 5;

    if (remaining <= 0) {
        await app.client.chat.postMessage({
            channel: sender,
            text: `오늘 수확한 아보카도가 다 떨어졌어요! 🥑 내일 만나요.`
        });
        return;
    }

    // 총 필요량 계산 (이모지 개수 × 수신자 수)
    const totalNeeded = avocadoCount * receiverIds.length;
    const actualTotal = Math.min(totalNeeded, remaining);

    // 균등 분배 계산 (앞에서부터 순서대로)
    const distribution = [];
    let remainingToDistribute = actualTotal;

    for (const receiverId of receiverIds) {
        const countForThis = Math.min(avocadoCount, remainingToDistribute);
        if (countForThis > 0) {
            distribution.push({ receiverId, count: countForThis });
            remainingToDistribute -= countForThis;
        } else {
            distribution.push({ receiverId, count: 0 });
        }
    }

    // 아보카도 전송
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
        } else {
            failedList.push(receiverId);
        }
    }

    // 결과 DM 메시지 생성
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

    if (resultMessage) {
        await app.client.chat.postMessage({
            channel: sender,
            text: resultMessage
        });
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
