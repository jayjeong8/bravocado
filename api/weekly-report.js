const { WebClient } = require('@slack/web-api');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

function aggregateWeeklyStats(transactions) {
    const giverTotals = {};
    const receiverTotals = {};
    const personalGiven = {};

    for (const tx of transactions) {
        // Global givers
        giverTotals[tx.sender_id] = (giverTotals[tx.sender_id] || 0) + tx.count;

        // Global receivers
        receiverTotals[tx.receiver_id] = (receiverTotals[tx.receiver_id] || 0) + tx.count;

        // Personal: sender -> receiver breakdown
        if (!personalGiven[tx.sender_id]) personalGiven[tx.sender_id] = {};
        personalGiven[tx.sender_id][tx.receiver_id] = (personalGiven[tx.sender_id][tx.receiver_id] || 0) + tx.count;
    }

    const topGivers = Object.entries(giverTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, total]) => ({ id, total }));

    const topReceivers = Object.entries(receiverTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, total]) => ({ id, total }));

    return { topGivers, topReceivers, personalGiven };
}

function buildRankingBlocks(items) {
    return items.map((item, i) => ({
        type: 'context',
        elements: [
            { type: 'mrkdwn', text: `*${i + 1}.*` },
            { type: 'mrkdwn', text: `<@${item.id}>` },
            { type: 'mrkdwn', text: `*${item.total}*` },
        ],
    }));
}

function buildWeeklyReportBlocks(topGivers, topReceivers, myTopGiven) {
    if (topGivers.length === 0 && topReceivers.length === 0) {
        return [
            { type: 'header', text: { type: 'plain_text', text: 'Weekly Avo Report 🥑📊', emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: 'It was a quiet week — no avos were given. Be the first one next week! 🌱' } },
        ];
    }

    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: 'Weekly Avo Report 🥑', emoji: true } },

        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*Top 5 Givers* 🫴' } },
        ...buildRankingBlocks(topGivers),

        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*Top 5 Receivers* 🧺' } },
        ...buildRankingBlocks(topReceivers),
    ];

    if (myTopGiven.length > 0) {
        blocks.push(
            { type: 'divider' },
            { type: 'section', text: { type: 'mrkdwn', text: '*You gave the most to* 💚' } },
            ...buildRankingBlocks(myTopGiven)
        );
    }

    return blocks;
}

module.exports = async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [txResult, usersResult] = await Promise.all([
            supabase.from('transactions').select('sender_id, receiver_id, count').gte('created_at', sevenDaysAgo),
            supabase.from('profiles').select('id'),
        ]);

        const transactions = txResult.data || [];
        const users = usersResult.data || [];
        const { topGivers, topReceivers, personalGiven } = aggregateWeeklyStats(transactions);

        let sentCount = 0;

        for (const user of users) {
            try {
                const myGiven = personalGiven[user.id]
                    ? Object.entries(personalGiven[user.id])
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([id, total]) => ({ id, total }))
                    : [];

                const blocks = buildWeeklyReportBlocks(topGivers, topReceivers, myGiven);
                await slack.chat.postMessage({ channel: user.id, blocks, text: 'Weekly Avo Report 🥑' });
                sentCount++;
            } catch (err) {
                console.error(`Failed to send weekly report to ${user.id}:`, err.message);
            }
        }

        return res.status(200).json({ success: true, sent: sentCount, total: users.length });
    } catch (err) {
        console.error('Weekly report failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};