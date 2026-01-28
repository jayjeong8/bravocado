const { sendDM, sendEphemeral, fetchMessage } = require('../slack');
const {
    extractMentions,
    getRemainingAvocados,
    canDistribute,
    excludeSender,
    buildSenderSuccessMessage,
    buildErrorMessage,
    executeTransfers,
} = require('../avocado');

const AVOCADO_REACTIONS = ['avocado', '아보카도'];
const REACTION_AVOCADO_COUNT = 1;

/**
 * 아보카도 리액션인지 확인
 */
function isAvocadoReaction(reaction) {
    return AVOCADO_REACTIONS.includes(reaction);
}

/**
 * 수신자 결정: 멘션된 사람들 또는 메시지 작성자
 * @returns {{ receivers: string[], isSelfMessage: boolean }}
 */
function determineReceivers(messageText, messageAuthor, senderId) {
    const mentionedUsers = extractMentions(messageText);

    if (mentionedUsers.length > 0) {
        return { receivers: mentionedUsers, isSelfMessage: false };
    }

    const isSelfMessage = senderId === messageAuthor;
    return { receivers: [messageAuthor], isSelfMessage };
}

/**
 * 리액션 기반 아보카도 전송 핸들러를 생성합니다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
function createReactionHandler(supabase) {
    return async ({ event, client }) => {
        if (!isAvocadoReaction(event.reaction)) return;

        const senderId = event.user;
        const { channel: channelId, ts: messageTs } = event.item;

        // 원본 메시지 조회
        const originalMessage = await fetchMessage(client, channelId, messageTs).catch(() => null);
        if (!originalMessage) return;

        const { user: messageAuthor, text: messageText = '' } = originalMessage;

        // 수신자 결정
        const { receivers, isSelfMessage } = determineReceivers(messageText, messageAuthor, senderId);
        if (isSelfMessage) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'));
            return;
        }

        const { filtered: receiverIds, selfIncluded } = excludeSender(receivers, senderId);
        if (receiverIds.length === 0) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'));
            return;
        }

        // 잔여 개수 확인
        const remaining = await getRemainingAvocados(supabase, senderId);
        if (remaining <= 0) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('no_remaining'));
            return;
        }

        if (!canDistribute(receiverIds, REACTION_AVOCADO_COUNT, remaining)) {
            await sendEphemeral(
                client,
                channelId,
                senderId,
                buildErrorMessage('insufficient', {
                    remaining,
                    totalNeeded: REACTION_AVOCADO_COUNT * receiverIds.length,
                    receiverCount: receiverIds.length,
                })
            );
            return;
        }

        // 전송 실행
        const { successList } = await executeTransfers({
            supabase,
            slackClient: client,
            senderId,
            receiverIds,
            avocadoCount: REACTION_AVOCADO_COUNT,
            context: { type: 'reaction', channelId, messageText },
        });

        // 결과 DM 전송
        if (successList.length > 0) {
            const remainingAfter = await getRemainingAvocados(supabase, senderId);
            const resultMessage = buildSenderSuccessMessage({ successList, remainingAfter, selfIncluded });
            if (resultMessage) {
                await sendDM(client, senderId, resultMessage);
            }
        }
    };
}

module.exports = { createReactionHandler };
