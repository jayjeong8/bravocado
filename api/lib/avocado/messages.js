/**
 * 아보카도 메시지 포맷팅
 */

/**
 * 수신자 목록을 포맷팅 (Oxford comma)
 * @param {string[]} receiverIds - 수신자 ID 배열
 * @returns {string} 포맷팅된 문자열
 */
function formatRecipientList(receiverIds) {
    const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    return formatter.format(receiverIds.map(id => `<@${id}>`));
}

/**
 * 수신자에게 보내는 DM 메시지 생성
 * @param {object} params
 * @param {number} params.count - 아보카도 개수
 * @param {string} params.senderId - 발신자 ID
 * @param {string} params.channelId - 채널 ID
 * @param {string} params.messageText - 원본 메시지 텍스트
 * @param {'message'|'reaction'} params.type - 전송 유형
 * @returns {string} DM 메시지
 */
function buildReceiverDM({ count, senderId, channelId, messageText, type }) {
    const plural = count > 1 ? 's' : '';

    if (type === 'reaction') {
        return `You received *${count} avo${plural}* from <@${senderId}> via reaction in <#${channelId}>.${messageText ? `\n> ${messageText}` : ''}`;
    }

    return `You received *${count} avo${plural}* from <@${senderId}> in <#${channelId}>.\n> ${messageText}`;
}

/**
 * 발신자에게 보내는 성공 메시지 생성
 * @param {object} params
 * @param {{ receiverId: string, count: number }[]} params.successList - 성공 목록
 * @param {number} params.remainingAfter - 전송 후 남은 아보카도 개수
 * @param {boolean} params.selfIncluded - 자기 자신이 포함되었는지
 * @returns {string|null} 성공 메시지
 */
function buildSenderSuccessMessage({ successList, remainingAfter, selfIncluded }) {
    if (successList.length === 0) return null;

    const avocadoCount = successList[0].count;
    const countPlural = avocadoCount > 1 ? 's' : '';
    const remainPlural = remainingAfter !== 1 ? 's' : '';
    const recipientList = formatRecipientList(successList.map(s => s.receiverId));

    let msg = `${recipientList} received *${avocadoCount} avo${countPlural}* from you. You have *${remainingAfter} avo${remainPlural}* left to give out today.`;

    if (selfIncluded) {
        msg += `\n(I skipped you, because you can't give avos to yourself!)`;
    }

    return msg;
}

/**
 * 에러 메시지 생성
 * @param {'self_only'|'no_remaining'|'insufficient'} errorType - 에러 유형
 * @param {object} context - 컨텍스트
 * @param {number} [context.remaining] - 남은 아보카도 개수
 * @param {number} [context.totalNeeded] - 필요한 아보카도 개수
 * @param {number} [context.receiverCount] - 수신자 수
 * @returns {string} 에러 메시지
 */
function buildErrorMessage(errorType, context = {}) {
    switch (errorType) {
        case 'self_only':
            return `We love self-care, but avos are for sharing! 🥑 You can't give them to yourself.`;

        case 'no_remaining':
            return `You're too generous! You've used up your daily supply. You have *0 avos* left. Come back tomorrow to spread more love. 💚`;

        case 'insufficient': {
            const { remaining, totalNeeded, receiverCount } = context;
            const plural = remaining !== 1 ? 's' : '';
            const neededPlural = totalNeeded > 1 ? 's' : '';
            return `You tried to give *${totalNeeded} avo${neededPlural}* to ${receiverCount} people, but you only have *${remaining} avo${plural}* left. No avos were sent. You have *${remaining} avo${plural}* left to give out today.`;
        }

        default:
            return `Something went wrong. Please try again.`;
    }
}

module.exports = {
    formatRecipientList,
    buildReceiverDM,
    buildSenderSuccessMessage,
    buildErrorMessage,
};
