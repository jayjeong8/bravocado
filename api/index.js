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

// 아보카도 감지
app.message(/:avocado:|🥑/, async ({ message, say }) => {
    if (message.subtype || message.bot_id) return; // 봇 무시

    const sender = message.user;
    const matches = message.text.match(/<@([A-Z0-9]+)>/g); // 멘션 추출
    if (!matches) return;

    const receiverIds = [...new Set(matches.map(m => m.replace(/[<@>]/g, '')))];

    for (const receiver of receiverIds) {
        if (receiver === sender) {
            await app.client.chat.postMessage({
                channel: sender,
                text: `자기 자신을 으깰 순 없어요! 😅`
            });
            continue;
        }

        // 1. 잔여 개수 확인
        const { data: user } = await supabase.from('profiles').select('remaining_daily').eq('id', sender).single();
        const limit = user ? user.remaining_daily : 5;

        if (limit <= 0) {
            await app.client.chat.postMessage({
                channel: sender,
                text: `오늘 수확한 아보카도가 다 떨어졌어요! 🥑 내일 만나요.`
            });
            return;
        }

        // 2. 아보카도 전송 (DB 함수 호출)
        const { error } = await supabase.rpc('give_avocado', {
            sender_id_input: sender, receiver_id_input: receiver, count: 1,
            message_text: message.text, channel_id_input: message.channel
        });

        if (!error) {
            await app.client.chat.postMessage({
                channel: sender,
                text: `Bravocado! 🥑 <@${receiver}>님이 잘 익은 아보카도를 받았어요!`
            });
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
