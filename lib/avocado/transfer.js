/**
 * 아보카도 전송 핵심 로직
 */

const { sendDM } = require('../slack');
const { buildReceiverDM } = require('./messages');

/**
 * 단일 수신자에게 아보카도 전송
 * @param {object} params
 * @param {object} params.supabase - Supabase client
 * @param {object} params.slackClient - Slack client
 * @param {string} params.senderId - 발신자 ID
 * @param {string} params.receiverId - 수신자 ID
 * @param {number} params.count - 아보카도 개수
 * @param {object} params.context - 컨텍스트 정보
 * @param {'message'|'reaction'} params.context.type - 전송 유형
 * @param {string} params.context.channelId - 채널 ID
 * @param {string} params.context.messageText - 원본 메시지 텍스트
 * @returns {Promise<boolean>} 성공 여부
 */
async function transferToRecipient({ supabase, slackClient, senderId, receiverId, count, context }) {
    const { type, channelId, messageText } = context;

    const { error } = await supabase.rpc('give_avocado', {
        sender_id_input: senderId,
        receiver_id_input: receiverId,
        count: count,
        message_text: messageText,
        channel_id_input: channelId,
    });

    if (error) {
        console.warn(`[avocado] transfer failed: ${senderId} → ${receiverId} (x${count}):`, error.message);
        return false;
    }

    const dmMessage = buildReceiverDM({
        count,
        senderId,
        channelId,
        messageText,
        type,
    });

    await sendDM(slackClient, receiverId, dmMessage);
    return true;
}

/**
 * 여러 수신자에게 아보카도 전송 실행
 * @param {object} params
 * @param {object} params.supabase - Supabase client
 * @param {object} params.slackClient - Slack client
 * @param {string} params.senderId - 발신자 ID
 * @param {string[]} params.receiverIds - 수신자 ID 배열
 * @param {number} params.avocadoCount - 각 수신자에게 보낼 아보카도 개수
 * @param {object} params.context - 컨텍스트 정보
 * @param {'message'|'reaction'} params.context.type - 전송 유형
 * @param {string} params.context.channelId - 채널 ID
 * @param {string} params.context.messageText - 원본 메시지 텍스트
 * @returns {Promise<{ successList: Array<{ receiverId: string, count: number }>, failedList: string[] }>}
 */
async function executeTransfers({ supabase, slackClient, senderId, receiverIds, avocadoCount, context }) {
    const successList = [];
    const failedList = [];

    for (const receiverId of receiverIds) {
        const success = await transferToRecipient({
            supabase,
            slackClient,
            senderId,
            receiverId,
            count: avocadoCount,
            context,
        });

        if (success) {
            successList.push({ receiverId, count: avocadoCount });
        } else {
            failedList.push(receiverId);
        }
    }

    return { successList, failedList };
}

module.exports = {
    transferToRecipient,
    executeTransfers,
};
