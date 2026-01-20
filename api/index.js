const { App, ExpressReceiver } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 환경 변수 로드
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    processBeforeResponse: true,
});

// 👇 이 로그 코드를 추가해서 배포 후 Vercel 로그를 확인하세요.
console.log('Bot Token Check:', process.env.SLACK_BOT_TOKEN ? 'Exist' : 'Missing');
console.log('Token starts with:', process.env.SLACK_BOT_TOKEN?.substring(0, 5));

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver,
});

// 🥑 아보카도 감지 로직 (:avocado: 텍스트 또는 🥑 이모지 모두 매칭)
app.message(/:avocado:|🥑/, async ({ message, say }) => {
    if (message.subtype || message.bot_id) return; // 봇 무시

    const sender = message.user;
    const matches = message.text.match(/<@([A-Z0-9]+)>/g); // 멘션 추출
    if (!matches) return;

    const receiverIds = [...new Set(matches.map(m => m.replace(/[<@>]/g, '')))];

    for (const receiver of receiverIds) {
        if (receiver === sender) {
            await say(`자기 자신을 으깰 순 없어요! 😅 <@${sender}>`);
            continue;
        }

        // 1. 잔여 개수 확인
        const { data: user } = await supabase.from('profiles').select('remaining_daily').eq('id', sender).single();
        const limit = user ? user.remaining_daily : 5;

        if (limit <= 0) {
            await say(`오늘 수확한 아보카도가 다 떨어졌어요! 🥑 내일 만나요.`);
            return;
        }

        // 2. 아보카도 전송 (DB 함수 호출)
        const { error } = await supabase.rpc('give_avocado', {
            sender_id_input: sender, receiver_id_input: receiver, count: 1,
            message_text: message.text, channel_id_input: message.channel
        });

        if (!error) await say(`Bravocado! 🥑 <@${receiver}>님이 잘 익은 아보카도를 받았어요!`);
    }
});

// 🏆 리더보드
app.command('/leaderboard', async ({ ack, say }) => {
    await ack();
    const { data: leaders } = await supabase.from('profiles').select('id, received_count').order('received_count', { ascending: false }).limit(5);

    let msg = "*🏆 명예의 전당*\n";
    leaders?.forEach((u, i) => msg += `${i+1}위 <@${u.id}>: ${u.received_count} 🥑\n`);
    await say(msg);
});

module.exports = async (req, res) => {
    // 디버깅을 위해 로그를 찍어봅니다 (Vercel 로그에서 확인 가능)
    console.log('Request Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request Body:', req.body);
    console.log('Request Body Type:', typeof req.body);

    // Body가 문자열인 경우 파싱
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
            req.body = body;
        } catch (e) {
            console.log('Body parse error:', e.message);
        }
    }

    // 1. 슬랙의 URL 검증(Challenge) 요청을 최우선으로 처리
    if (body && body.type === 'url_verification') {
        console.log('Challenge request received, responding with:', body.challenge);
        return res.status(200).json({ challenge: body.challenge });
    }

    // 2. 일반적인 봇 이벤트 처리
    if (req.method === 'POST') {
        // Bolt의 서명 검증을 위해 rawBody 설정
        // Vercel이 이미 body를 파싱했으므로 rawBody를 다시 만들어줌
        if (!req.rawBody && req.body) {
            req.rawBody = Buffer.from(JSON.stringify(req.body));
        }

        // Bolt가 요청을 처리하도록 넘김
        await receiver.requestHandler(req, res);
    } else {
        // 3. 브라우저 접속 시 (GET 요청)
        res.status(200).send('Bravocado is running! 🥑');
    }
};
