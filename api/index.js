const { App, ExpressReceiver } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 핸들러
const { createMessageHandler } = require('../lib/handlers/message');
const { createReactionHandler } = require('../lib/handlers/reaction');
const { createHomeHandler } = require('../lib/handlers/home');
const { createTacoMessageHandler, createTacoReactionHandler } = require('../lib/handlers/taco');
const { handleJokeRequest } = require('../lib/jokes');

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

// 핸들러 등록
app.message(/:avocado:|🥑/, createMessageHandler(supabase));
app.message(/:taco:|🌮/, createTacoMessageHandler());
app.event('reaction_added', createReactionHandler(supabase));
app.event('reaction_added', createTacoReactionHandler());
app.event('app_home_opened', createHomeHandler(supabase));
app.event('app_mention', async ({ event, say }) => {
    await handleJokeRequest({ event, say });
});

// Vercel 엔트리포인트
module.exports = async (req, res) => {
    // 재시도 요청 무시 (중복 처리 방지)
    if (req.headers['x-slack-retry-num']) {
        return res.status(200).send();
    }

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
