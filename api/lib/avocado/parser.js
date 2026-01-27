/**
 * 아보카도 메시지 파싱 유틸리티
 */

/**
 * 텍스트에서 아보카도 이모지 개수 카운트
 * @param {string} text - 검사할 텍스트
 * @returns {number} 아보카도 개수
 */
function countAvocados(text) {
    const emojiMatches = text.match(/🥑/g) || [];
    const slackMatches = text.match(/:avocado:/g) || [];
    return emojiMatches.length + slackMatches.length;
}

/**
 * 텍스트에서 멘션된 사용자 ID 추출
 * @param {string} text - 검사할 텍스트
 * @returns {string[]} 유니크한 사용자 ID 배열
 */
function extractMentions(text) {
    const matches = text.match(/<@([A-Z0-9]+)>/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[<@>]/g, '')))];
}

/**
 * 아보카도 메시지 파싱
 * @param {object} message - Slack 메시지 객체
 * @returns {object|null} 파싱 결과 또는 null
 */
function parseAvocadoMessage(message) {
    if (message.subtype || message.bot_id) return null;

    const sender = message.user;
    const receiverIds = extractMentions(message.text);
    if (receiverIds.length === 0) return null;

    const avocadoCount = countAvocados(message.text);
    if (avocadoCount === 0) return null;

    return { sender, receiverIds, avocadoCount };
}

module.exports = {
    countAvocados,
    extractMentions,
    parseAvocadoMessage,
};
