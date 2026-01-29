// data 폴더의 json 파일을 require로 불러옵니다.
// (Node.js에서는 JSON 파일을 모듈처럼 불러올 수 있습니다)
const jokesData = require('../data/jokes.json');

// 트리거 명령어 정의
const TRIGGERS = {
    KR: ['잘 익었니', '잘 익었니?', '농담'],
    EN: ['make it ripe', 'tell a joke']
};

/**
 * 농담 타입 반환
 * @param {Object} joke - 농담 객체
 * @returns {string} 'qa' | 'dialogue'
 */
function getJokeType(joke) {
    return joke.type;
}

/**
 * author context block 생성
 * @param {string} author - 작성자 이름
 * @returns {Object} Slack context block
 */
function createAuthorContext(author) {
    return {
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: `@${author}`
            }
        ]
    };
}

/**
 * 타입별 렌더러
 */
const RENDERERS = {
    /**
     * Q&A 형식 렌더러
     */
    async qa(joke, say, threadTs) {
        // Q 전송
        await say({
            text: `Q: ${joke.q}`,
            thread_ts: threadTs
        });

        // 2초 대기 후 A 전송 (author 있으면 context 포함)
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (joke.author) {
            await say({
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: `A: ${joke.a}` }
                    },
                    createAuthorContext(joke.author)
                ],
                text: `A: ${joke.a}`,
                thread_ts: threadTs
            });
        } else {
            await say({
                text: `A: ${joke.a}`,
                thread_ts: threadTs
            });
        }
    },

    /**
     * 대화 형식 렌더러
     */
    async dialogue(joke, say, threadTs) {
        const lines = joke.lines || [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isLast = i === lines.length - 1;

            // 마지막 줄이고 author가 있으면 context 포함
            if (isLast && joke.author) {
                await say({
                    blocks: [
                        {
                            type: 'section',
                            text: { type: 'mrkdwn', text: `${line.speaker}: ${line.text}` }
                        },
                        createAuthorContext(joke.author)
                    ],
                    text: `${line.speaker}: ${line.text}`,
                    thread_ts: threadTs
                });
            } else {
                await say({
                    text: `${line.speaker}: ${line.text}`,
                    thread_ts: threadTs
                });
            }

            // 마지막 줄이 아니면 2초 대기
            if (!isLast) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
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

    // 타입별 렌더러 호출
    const jokeType = getJokeType(selectedJoke);
    const renderer = RENDERERS[jokeType];

    if (renderer) {
        await renderer(selectedJoke, say, threadTs);
    }
}

module.exports = { handleJokeRequest };