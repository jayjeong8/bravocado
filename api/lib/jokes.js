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

    let selectedJoke = null;
    let introText = "";

    if (isKr) {
        // 한국어 농담 선택
        const jokes = jokesData.KR;
        selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];
        introText = "방금 수확한 신선한 농담입니다 🚜";
    } else {
        // 영어 농담 선택 (기본값)
        const jokes = jokesData.EN;
        selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];
        introText = "Fresh from the farm 🚜";
    }

    // 슬랙 메시지 전송
    await say({
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `${introText}\n\n*Q:* ${selectedJoke.q}\n*A:* ${selectedJoke.a}`
                }
            },
        ]
    });
}

module.exports = { handleJokeRequest };