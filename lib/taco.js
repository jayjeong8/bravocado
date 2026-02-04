const PROMO_MESSAGE =
    '방금 타코🌮를 보내셨군요! 다음엔 아보카도🥑 어떠세요?\n제가 배달해 드릴게요! `/invite @Bravocado`';

/**
 * 텍스트에 타코 이모지가 포함되어 있는지 확인
 */
function containsTaco(text) {
    if (!text) return false;
    return text.includes('🌮') || text.includes(':taco:');
}

/**
 * 리액션이 타코인지 확인
 */
function isTacoReaction(reaction) {
    return reaction === 'taco';
}

module.exports = { PROMO_MESSAGE, containsTaco, isTacoReaction };
