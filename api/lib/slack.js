/**
 * Slack API 유틸리티 함수
 */

/**
 * 사용자에게 DM 전송
 * @param {object} client - Slack client
 * @param {string} userId - 수신자 사용자 ID
 * @param {string} text - 메시지 텍스트
 */
async function sendDM(client, userId, text) {
    return client.chat.postMessage({ channel: userId, text });
}

/**
 * Ephemeral 메시지 전송 (특정 사용자만 볼 수 있는 메시지)
 * @param {object} client - Slack client
 * @param {string} channelId - 채널 ID
 * @param {string} userId - 수신자 사용자 ID
 * @param {string} text - 메시지 텍스트
 */
async function sendEphemeral(client, channelId, userId, text) {
    return client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
    });
}

/**
 * 메시지 조회
 * @param {object} client - Slack client
 * @param {string} channelId - 채널 ID
 * @param {string} messageTs - 메시지 타임스탬프
 */
async function fetchMessage(client, channelId, messageTs) {
    const result = await client.conversations.history({
        channel: channelId,
        latest: messageTs,
        inclusive: true,
        limit: 1,
    });

    if (result.messages && result.messages.length > 0) {
        return result.messages[0];
    }
    return null;
}

module.exports = {
    sendDM,
    sendEphemeral,
    fetchMessage,
};
