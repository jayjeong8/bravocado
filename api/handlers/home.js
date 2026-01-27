const { DEFAULT_DAILY_AVOCADOS } = require('../lib/avocado');
const { getTitle, getGiverTitle } = require('../lib/titles');

/**
 * Home Tab 핸들러를 생성합니다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
function createHomeHandler(supabase) {
    return async ({ event, client }) => {
        const userId = event.user;

        const [profileResult, leaderboardResult, giversResult] = await Promise.all([
            supabase.from('profiles').select('given_count, received_count, remaining_daily').eq('id', userId).single(),
            supabase.from('profiles').select('id, received_count').order('received_count', { ascending: false }).limit(10),
            supabase.from('profiles').select('id, given_count').order('given_count', { ascending: false }).limit(10),
        ]);

        const given = profileResult.data?.given_count ?? 0;
        const received = profileResult.data?.received_count ?? 0;
        const remaining = profileResult.data?.remaining_daily ?? DEFAULT_DAILY_AVOCADOS;
        const giverTitle = getGiverTitle(given);
        const receiverTitle = getTitle(received);
        const leaders = leaderboardResult.data || [];
        const givers = giversResult.data || [];

        // Leaderboard 블록 생성
        const leaderboardBlocks = leaders.map((u, i) => {
            const userTitle = getTitle(u.received_count);
            return {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `*${i + 1}.*` },
                    { type: 'mrkdwn', text: `<@${u.id}>` },
                    { type: 'mrkdwn', text: `*${u.received_count}*` },
                    { type: 'mrkdwn', text: `\`${userTitle}\`` },
                ],
            };
        });

        // Top Givers 블록 생성
        const giversBlocks = givers.map((u, i) => {
            const title = getGiverTitle(u.given_count);
            return {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `*${i + 1}.*` },
                    { type: 'mrkdwn', text: `<@${u.id}>` },
                    { type: 'mrkdwn', text: `*${u.given_count}*` },
                    { type: 'mrkdwn', text: `\`${title}\`` },
                ],
            };
        });

        await client.views.publish({
            user_id: userId,
            view: {
                type: 'home',
                blocks: [
                    {
                        type: 'header',
                        text: { type: 'plain_text', text: 'My Avo Stats 🥑', emoji: true },
                    },
                    { type: 'divider' },
                    {
                        type: 'context',
                        elements: [
                            { type: 'mrkdwn', text: 'Given' },
                            { type: 'mrkdwn', text: `*${given}*` },
                            { type: 'mrkdwn', text: `\`${giverTitle}\`` },
                        ],
                    },
                    {
                        type: 'context',
                        elements: [
                            { type: 'mrkdwn', text: 'Received' },
                            { type: 'mrkdwn', text: `*${received}*` },
                            { type: 'mrkdwn', text: `\`${receiverTitle}\`` },
                        ],
                    },
                    {
                        type: 'context',
                        elements: [
                            { type: 'mrkdwn', text: 'Avos left to give today' },
                            { type: 'mrkdwn', text: `*${remaining}*` },
                        ],
                    },

                    {
                        type: 'header',
                        text: { type: 'plain_text', text: 'Top Avo Givers 🫴', emoji: true },
                    },
                    { type: 'divider' },
                    ...giversBlocks,

                    {
                        type: 'header',
                        text: { type: 'plain_text', text: 'Top Avo Receivers 🧺', emoji: true },
                    },
                    { type: 'divider' },
                    ...leaderboardBlocks,

                    { type: 'context', elements: [{ type: 'mrkdwn', text: ' ' }] },
                    { type: 'divider' },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: '💡 *Tip:* Mention a teammate with 🥑 to spread the good vibes!',
                            },
                        ],
                    },
                ],
            },
        });
    };
}

module.exports = { createHomeHandler };
