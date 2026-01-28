/**
 * 칭호 계산 (받은 사람)
 */
function getTitle(receivedCount) {
    if (receivedCount >= 500) return 'Holy Guacamole 👑';
    if (receivedCount >= 250) return 'Certified Fresh ✨';
    if (receivedCount >= 100) return 'Big Avo Energy 🌳';
    if (receivedCount >= 50) return 'Warming Up ☀️';
    if (receivedCount >= 10) return 'Just Watered 💧';
    return 'Seed Mode 🌱';
}

/**
 * 칭호 계산 (준 사람)
 */
function getGiverTitle(givenCount) {
    if (givenCount >= 500) return 'Master Farmer 👨‍🌾';
    if (givenCount >= 250) return 'Harvest Machine 🚜';
    if (givenCount >= 100) return 'Tree Hugger 🌳';
    if (givenCount >= 50) return 'Green Thumb 🪴';
    if (givenCount >= 10) return 'First Rain 🌧️';
    return 'Dirt Digger ⛏️';
}

module.exports = { getTitle, getGiverTitle };
