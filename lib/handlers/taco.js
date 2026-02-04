const { sendDM } = require('../slack');
const { containsTaco, isTacoReaction, PROMO_MESSAGE } = require('../taco');

/**
 * 타코 메시지 감지 → 홍보 DM 핸들러
 */
function createTacoMessageHandler() {
    return async ({ message, client }) => {
        // 봇 메시지 무시
        if (message.subtype === 'bot_message' || message.bot_id) return;
        if (!containsTaco(message.text)) return;

        try {
            await sendDM(client, message.user, PROMO_MESSAGE);
        } catch (error) {
            console.error('[TacoMessageHandler] DM 전송 실패:', error.message);
        }
    };
}

/**
 * 타코 리액션 감지 → 홍보 DM 핸들러
 */
function createTacoReactionHandler() {
    return async ({ event, client }) => {
        if (!isTacoReaction(event.reaction)) return;

        try {
            await sendDM(client, event.user, PROMO_MESSAGE);
        } catch (error) {
            console.error('[TacoReactionHandler] DM 전송 실패:', error.message);
        }
    };
}

module.exports = { createTacoMessageHandler, createTacoReactionHandler };
