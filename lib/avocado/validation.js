/**
 * 아보카도 전송 검증 로직
 */

const DEFAULT_DAILY_AVOCADOS = 5;

/**
 * 사용자의 남은 아보카도 개수 조회
 * @param {object} supabase - Supabase client
 * @param {string} senderId - 전송자 ID
 * @param {number} defaultDaily - 기본 일일 아보카도 개수
 * @returns {Promise<number>} 남은 아보카도 개수
 */
async function getRemainingAvocados(supabase, senderId, defaultDaily = DEFAULT_DAILY_AVOCADOS) {
    const { data: user } = await supabase
        .from('profiles')
        .select('remaining_daily')
        .eq('id', senderId)
        .single();

    return user ? user.remaining_daily : defaultDaily;
}

/**
 * 아보카도 분배 가능 여부 확인 (all-or-nothing)
 * @param {string[]} receiverIds - 수신자 ID 배열
 * @param {number} avocadoCount - 각 수신자에게 보낼 아보카도 개수
 * @param {number} remaining - 남은 아보카도 개수
 * @returns {boolean} 분배 가능 여부
 */
function canDistribute(receiverIds, avocadoCount, remaining) {
    const totalNeeded = avocadoCount * receiverIds.length;
    return totalNeeded <= remaining;
}

/**
 * 수신자 목록에서 발신자 제외
 * @param {string[]} receiverIds - 수신자 ID 배열
 * @param {string} senderId - 발신자 ID
 * @returns {{ filtered: string[], selfIncluded: boolean }}
 */
function excludeSender(receiverIds, senderId) {
    const selfIncluded = receiverIds.includes(senderId);
    const filtered = receiverIds.filter(id => id !== senderId);
    return { filtered, selfIncluded };
}

module.exports = {
    DEFAULT_DAILY_AVOCADOS,
    getRemainingAvocados,
    canDistribute,
    excludeSender,
};
