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
 * @param {string} [threadTs] - 스레드 타임스탬프 (선택적)
 */
async function sendEphemeral(client, channelId, userId, text, threadTs) {
    const payload = {
        channel: channelId,
        user: userId,
        text,
    };

    if (threadTs) {
        payload.thread_ts = threadTs;
    }

    return client.chat.postEphemeral(payload);
}

/**
 * 사용자 정보 조회
 * @param {object} client - Slack client
 * @param {string} userId - 사용자 ID
 * @returns {Promise<object|null>} 사용자 정보 또는 null
 */
async function fetchUserInfo(client, userId) {
    try {
        const result = await client.users.info({ user: userId });
        return result.user || null;
    } catch {
        return null;
    }
}

/**
 * 스레드 댓글 조회
 * @param {object} client - Slack client
 * @param {string} channelId - 채널 ID
 * @param {string} threadTs - 스레드 원본 메시지 타임스탬프
 * @param {string} messageTs - 조회할 메시지 타임스탬프
 * @returns {Promise<object|null>} 메시지 또는 null
 */
async function fetchThreadReply(client, channelId, threadTs, messageTs) {
    const result = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        latest: messageTs,
        inclusive: true,
        limit: 1,
    });

    if (result.messages && result.messages.length > 0) {
        return result.messages.find((msg) => msg.ts === messageTs) || null;
    }
    return null;
}

/**
 * 메시지 조회 (채널 메시지 및 스레드 댓글 모두 지원)
 * @param {object} client - Slack client
 * @param {string} channelId - 채널 ID
 * @param {string} messageTs - 메시지 타임스탬프
 * @returns {Promise<object|null>} 메시지 또는 null
 */
async function fetchMessage(client, channelId, messageTs) {
    const result = await client.conversations.history({
        channel: channelId,
        latest: messageTs,
        inclusive: true,
        limit: 1,
    });

    if (result.messages && result.messages.length > 0) {
        const message = result.messages[0];

        // 요청한 메시지와 일치하면 반환
        if (message.ts === messageTs) {
            return message;
        }

        // 불일치: 스레드 댓글일 가능성 → 스레드에서 재조회
        const threadReply = await fetchThreadReply(
            client,
            channelId,
            message.ts,
            messageTs
        );
        if (threadReply) {
            return threadReply;
        }
    }

    return null;
}

module.exports = {
    sendDM,
    sendEphemeral,
    fetchUserInfo,
    fetchMessage,
};
