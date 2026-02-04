const PROMO_MESSAGE = [
    '혹시 🌮 대신 🥑 써보실 생각 없으신가요?',
    'Bravocado로 동료에게 감사를 전해보세요! 🥑',
    '사용법: `@동료이름 :avocado:` 라고 보내면 끝!',
].join('\n');

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
