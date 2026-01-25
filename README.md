# Bravocado 🥑

<img src="assets/avo_rounded_small.png" alt="Bravocado" width="200" />

**The tastiest way to build a culture of gratitude in your Slack workspace.**

[한국어](README.ko.md)

![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Supabase%20%7C%20Slack_Bolt-%234f7002)


## Introduction

**Bravocado** is a gamified peer-to-peer recognition bot for Slack. We believe feedback shouldn't be boring forms—it should be fun!

When a teammate helps you out, simply send them an avocado emoji. Bravocado tracks these interactions, manages daily allowances, and helps team members grow from a tiny "Seed" to "Holy Guacamole" status.

## Key Features

### 1. 🥑 Avocado Giving
- **Simple Syntax:** Mention teammates and add `🥑` (or `:avocado:`) to your message.
- **Multi-User Support:** `@Alice @Bob 🥑` sends 1 avocado to each person.
- **Multi-Avocado Support:** `@Alice 🥑🥑` sends 2 avocados at once.
- **Smart Notifications:** Recipients get a DM with the sender's name, channel, and original message.

### 2. ⚖️ Fair Distribution (All-or-Nothing)
To ensure fairness, Bravocado uses **all-or-nothing** logic:
- If you try `@Alice @Bob @Charlie 🥑` but only have 2 avocados left, the transaction is cancelled.
- This prevents scenarios where only the first few people receive rewards while others don't.
- You'll receive an ephemeral error message visible only to you.

### 3. 🧺 Daily Limits
- Every user receives **5 avocados** daily to give away.
- Balances reset at midnight KST.
- **Self-Gifting Prevention:** You cannot give avocados to yourself—they're for sharing!

### 4. 🏠 Home Tab Dashboard
Click on the **Bravocado** app in Slack to view your App Home:
- **My Stats:** Total received, total given, and remaining daily balance.
- **Top Givers:** Leaderboard of the most generous teammates.
- **Top Receivers:** Leaderboard of the most recognized teammates.

### 5. 🏆 Progression System (Titles)
Users earn titles based on their activity:

| Count | Giver Title | Receiver Title |
| :--- | :--- | :--- |
| **500+** | Master Farmer 👨‍🌾 | Holy Guacamole 👑 |
| **250+** | Harvest Machine 🚜 | Certified Fresh ✨ |
| **100+** | Tree Hugger 🌳 | Big Avo Energy 🌳 |
| **50+** | Green Thumb 🪴 | Warming Up ☀️ |
| **10+** | First Rain 🌧️ | Just Watered 💧 |
| **0–9** | Dirt Digger ⛏️ | Seed Mode 🌱 |

### 6. 📊 Weekly Reports
Every Monday at 09:00 KST, each user receives a DM summarizing the past week:
- Top 5 global givers and receivers
- Your personal top 5 recipients

---

## Tech Stack

- **Runtime:** Node.js (Vercel Serverless Functions)
- **Framework:** [@slack/bolt](https://slack.dev/bolt-js/) v4
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL + RPC)
- **Deployment:** [Vercel](https://vercel.com/)

---

## Getting Started

### 1. Database Setup (Supabase)

Run [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL Editor. It creates:
- **`profiles`** — Per-user give/receive counts and daily balance
- **`transactions`** — Logs every avocado transfer with context
- **`give_avocado()`** — Transactional RPC for atomic transfers
- **`reset_daily_avocados()`** — Scheduled function to reset balances at midnight KST

### 2. Environment Variables

Configure the following in your `.env` file or Vercel Dashboard:

```bash
# Slack API
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Cron Authentication
CRON_SECRET=your-cron-secret
```

### 3. Slack App Configuration

**Bot Token Scopes:**
- `chat:write` — Post messages and ephemeral messages
- `chat:write.public` — Post in channels the bot hasn't joined
- `users:read` — Fetch user display names
- `im:write` — Open and send DMs

**Event Subscriptions:**
- `message.channels` / `message.groups` — Detect avocado messages
- `app_home_opened` — Render the Home tab dashboard

### 4. Deploy to Vercel

1. Link the repo to a Vercel project.
2. Add environment variables in the Vercel dashboard.
3. Deploy — `vercel.json` handles routing and cron scheduling automatically.

The cron job (`0 0 * * 1`) triggers `/api/weekly-report` every Monday at 00:00 UTC.

