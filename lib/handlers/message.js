const { sendDM, sendEphemeral } = require('../slack');
const {
    parseAvocadoMessage,
    getRemainingAvocados,
    canDistribute,
    excludeSender,
    excludeBots,
    buildSenderSuccessMessage,
    buildErrorMessage,
    executeTransfers,
} = require('../avocado');

/**
 * 메시지 기반 아보카도 전송 핸들러를 생성합니다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
function createMessageHandler(supabase) {
    return async ({ message, client }) => {
        const parsed = parseAvocadoMessage(message);
        if (!parsed) return;

        const { sender, receiverIds: allReceiverIds, avocadoCount } = parsed;
        const { filtered: afterSenderFilter, selfIncluded } = excludeSender(allReceiverIds, sender);

        // 스레드 내 메시지인 경우 해당 스레드에 ephemeral 표시
        const threadTs = message.thread_ts || message.ts;

        // 자기 자신에게만 보낸 경우
        if (afterSenderFilter.length === 0) {
            await sendEphemeral(client, message.channel, sender, buildErrorMessage('self_only'), threadTs);
            return;
        }

        // 봇 제외 (봇만 태그된 경우 조용히 스킵)
        const { filtered: receiverIds } = await excludeBots(client, afterSenderFilter);
        if (receiverIds.length === 0) {
            return;
        }

        // 잔여 개수 확인
        const remaining = await getRemainingAvocados(supabase, sender);

        if (remaining <= 0) {
            await sendEphemeral(client, message.channel, sender, buildErrorMessage('no_remaining'), threadTs);
            return;
        }

        // All-or-nothing: 부족하면 아무에게도 보내지 않음
        if (!canDistribute(receiverIds, avocadoCount, remaining)) {
            const totalNeeded = avocadoCount * receiverIds.length;
            await sendEphemeral(
                client,
                message.channel,
                sender,
                buildErrorMessage('insufficient', { remaining, totalNeeded, receiverCount: receiverIds.length }),
                threadTs
            );
            return;
        }

        const { successList } = await executeTransfers({
            supabase,
            slackClient: client,
            senderId: sender,
            receiverIds,
            avocadoCount,
            context: {
                type: 'message',
                channelId: message.channel,
                messageText: message.text,
            },
        });

        // 결과 DM 전송
        if (successList.length > 0) {
            const remainingAfter = await getRemainingAvocados(supabase, sender);
            const resultMessage = buildSenderSuccessMessage({ successList, remainingAfter, selfIncluded });
            if (resultMessage) {
                await sendDM(client, sender, resultMessage);
            }
        }
    };
}

module.exports = { createMessageHandler };
