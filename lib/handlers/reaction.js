const { sendDM, sendEphemeral, fetchMessageWithPermalink } = require('../slack');
const {
    extractMentions,
    getRemainingAvocados,
    canDistribute,
    excludeSender,
    excludeBots,
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
    return async ({ event, client, body }) => {
        if (!isAvocadoReaction(event.reaction)) return;

        const senderId = event.user;
        const { channel: channelId, ts: messageTs } = event.item;

        // 원본 메시지 조회
        const originalMessage = await fetchMessageWithPermalink(client, channelId, messageTs).catch((error) => {
            console.error('[ReactionHandler] fetchMessageWithPermalink failed:', {
                channelId,
                messageTs,
                error: error.message,
                errorData: error.data,
            });
            return null;
        });
        if (!originalMessage) {
            console.warn('[ReactionHandler] originalMessage is null, skipping');
            return;
        }

        const { user: messageAuthor, text: messageText = '' } = originalMessage;

        // 스레드 내 답글인 경우에만 해당 스레드에 ephemeral 표시
        // (스레드 부모 메시지는 thread_ts === ts이므로 채널에 표시)
        const isThreadReply = originalMessage.thread_ts && originalMessage.thread_ts !== originalMessage.ts;
        const threadTs = isThreadReply ? originalMessage.thread_ts : undefined;

        // 수신자 결정
        const { receivers, isSelfMessage } = determineReceivers(messageText, messageAuthor, senderId);
        if (isSelfMessage) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'), threadTs);
            return;
        }

        const { filtered: afterSenderFilter, selfIncluded } = excludeSender(receivers, senderId);

        // 자기 자신에게만 보낸 경우
        if (afterSenderFilter.length === 0) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('self_only'), threadTs);
            return;
        }

        // 봇 제외 (봇만 태그된 경우 조용히 스킵)
        const { filtered: receiverIds } = await excludeBots(client, afterSenderFilter);
        if (receiverIds.length === 0) {
            return;
        }

        // 잔여 개수 확인
        const remaining = await getRemainingAvocados(supabase, senderId);
        if (remaining <= 0) {
            await sendEphemeral(client, channelId, senderId, buildErrorMessage('no_remaining'), threadTs);
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
                }),
                threadTs
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
            context: { type: 'reaction', channelId, messageText, eventId: body.event_id },
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
