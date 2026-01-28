// data 폴더의 json 파일을 require로 불러옵니다.
// (Node.js에서는 JSON 파일을 모듈처럼 불러올 수 있습니다)
const jokesData = require('../data/jokes.json');

// 트리거 명령어 정의
const TRIGGERS = {
    KR: ['잘 익었니', '잘 익었니?', '농담'],
    EN: ['make it ripe', 'tell a joke']
};

/**
 * 메시지 텍스트를 분석하여 농담 요청인지 확인하고, 적절한 농담을 전송합니다.
 * @param {Object} param0 - Bolt framework의 event, say 객체
 */
async function handleJokeRequest({ event, say }) {
    const text = event.text.toLowerCase();

    // 언어 감지
    const isKr = TRIGGERS.KR.some(t => text.includes(t));
    const isEn = TRIGGERS.EN.some(t => text.includes(t));

    // 농담 요청이 아니면 함수 종료
    if (!isKr && !isEn) return;

    const jokes = isKr ? jokesData.KR : jokesData.EN;
    const selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];

    // 스레드 내 요청이면 해당 스레드에, 채널 메시지면 새 스레드로 응답
    const threadTs = event.thread_ts || event.ts;

    // Q 먼저 전송
    await say({
        text: `Q: ${selectedJoke.q}`,
        thread_ts: threadTs
    });

    // 잠시 대기 후 A 전송
    await new Promise(resolve => setTimeout(resolve, 2000));
    await say({
        text: `A: ${selectedJoke.a}`,
        thread_ts: threadTs
    });
}

module.exports = { handleJokeRequest };