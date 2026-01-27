# Bravocado 🥑

<img src="assets/avo_rounded_small.png" alt="Bravocado" width="200" />

**Slack 워크스페이스에 감사 문화를 심는 가장 맛있는 방법.**

![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Supabase%20%7C%20Slack_Bolt-%234f7002)


## 소개

**Bravocado**는 Slack을 위한 게이미피케이션 기반 동료 인정 봇입니다. 피드백은 지루한 설문이 아니라 재미있어야 한다고 믿습니다!

동료가 도움을 줬다면, 아보카도 이모지를 보내세요. Bravocado가 이 상호작용을 추적하고, 일일 한도를 관리하며, 팀원들이 작은 "씨앗"에서 "Holy Guacamole" 레벨까지 성장할 수 있도록 돕습니다.

## 주요 기능

### 1. 🥑 아보카도 보내기
- **간단한 문법:** 동료를 멘션하고 `🥑` (또는 `:avocado:`)를 메시지에 추가하세요.
- **다중 사용자 지원:** `@Alice @Bob 🥑`는 각각에게 1개씩 전송됩니다.
- **다중 아보카도 지원:** `@Alice 🥑🥑`는 한 번에 2개를 전송합니다.
- **리액션 지원:** 메시지에 `:avocado:` 리액션을 추가하면 1개가 전송됩니다.
  - 다른 사람 메시지에 리액션 → 메시지 작성자에게 전송.
  - 내 메시지에 리액션 (멘션 있을 경우) → 멘션된 사람들에게 전송.
- **스마트 알림:** 받는 사람은 보낸 사람, 채널, 원본 메시지가 포함된 DM을 받습니다.

### 2. ⚖️ 공정한 분배 (All-or-Nothing)
공정성을 위해 Bravocado는 **전부 아니면 전무** 로직을 사용합니다:
- `@Alice @Bob @Charlie 🥑`를 시도했는데 아보카도가 2개만 남았다면, 거래가 취소됩니다.
- 일부만 보상을 받고 나머지는 받지 못하는 상황을 방지합니다.
- 본인에게만 보이는 임시 에러 메시지를 받게 됩니다.

### 3. 🧺 일일 한도
- 모든 사용자는 매일 **5개의 아보카도**를 받습니다.
- 잔액은 매일 자정(KST)에 초기화됩니다.
- **셀프 선물 방지:** 자신에게는 아보카도를 줄 수 없습니다—나눔을 위한 것이니까요!

### 4. 🏠 홈 탭 대시보드
Slack에서 **Bravocado** 앱을 클릭하면 App Home을 볼 수 있습니다:
- **내 통계:** 받은 총 개수, 준 총 개수, 오늘 남은 개수.
- **Top Givers:** 가장 관대한 동료들의 리더보드.
- **Top Receivers:** 가장 많이 인정받은 동료들의 리더보드.

### 5. 🏆 성장 시스템 (칭호)
활동에 따라 칭호를 획득합니다:

| 개수 | Giver 칭호 | Receiver 칭호 |
| :--- | :--- | :--- |
| **500+** | Master Farmer 👨‍🌾 | Holy Guacamole 👑 |
| **250+** | Harvest Machine 🚜 | Certified Fresh ✨ |
| **100+** | Tree Hugger 🌳 | Big Avo Energy 🌳 |
| **50+** | Green Thumb 🪴 | Warming Up ☀️ |
| **10+** | First Rain 🌧️ | Just Watered 💧 |
| **0–9** | Dirt Digger ⛏️ | Seed Mode 🌱 |

### 6. 📊 주간 리포트
매주 월요일 오전 9시(KST)에 지난 주를 요약한 DM을 받습니다:
- 전체 Top 5 givers와 receivers
- 나의 Top 5 수신자

### 7. 🎭 아보카도 농담
Bravocado를 멘션하고 트리거 문구를 입력하면 랜덤 아보카도 농담을 받습니다:
- **한국어:** `@Bravocado 잘 익었니?` 또는 `@Bravocado 농담`
- **영어:** `@Bravocado make it ripe` 또는 `@Bravocado tell a joke`

---

## 기술 스택

- **런타임:** Node.js (Vercel Serverless Functions)
- **프레임워크:** [@slack/bolt](https://slack.dev/bolt-js/) v4
- **데이터베이스:** [Supabase](https://supabase.com/) (PostgreSQL + RPC)
- **배포:** [Vercel](https://vercel.com/)

---

## 시작하기

### 1. 데이터베이스 설정 (Supabase)

Supabase SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행하세요. 다음을 생성합니다:
- **`profiles`** — 사용자별 give/receive 카운트 및 일일 잔액
- **`transactions`** — 컨텍스트와 함께 모든 아보카도 전송 기록
- **`give_avocado()`** — 아보카도 전송 처리 (전부 성공 또는 전부 실패)
- **`reset_daily_avocados()`** — 자정(KST)에 잔액을 초기화하는 스케줄 함수

### 2. 환경 변수

`.env` 파일 또는 Vercel Dashboard에서 다음을 설정하세요:

```bash
# Slack API
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Cron 인증
CRON_SECRET=your-cron-secret
```

### 3. Slack 앱 설정

**Bot Token Scopes:**
- `chat:write` — 메시지 및 임시 메시지 전송
- `chat:write.public` — 봇이 참여하지 않은 채널에 전송
- `users:read` — 사용자 표시 이름 조회
- `im:write` — DM 열기 및 전송

**Event Subscriptions:**
- `message.channels` — 아보카도 메시지 감지
- `reaction_added` — 아보카도 리액션 감지
- `app_home_opened` — 홈 탭 대시보드 렌더링
- `app_mention` — 멘션 시 농담 요청 응답

### 4. Vercel 배포

1. 레포를 Vercel 프로젝트에 연결합니다.
2. Vercel 대시보드에서 환경 변수를 추가합니다.
3. 배포 — `vercel.json`이 라우팅과 크론 스케줄링을 자동으로 처리합니다.

크론 작업(`0 0 * * 1`)은 매주 월요일 00:00 UTC에 `/api/weekly-report`를 트리거합니다.

### 5. 주간 리포트 테스트

주간 리포트 엔드포인트를 수동으로 트리거하여 테스트할 수 있습니다:

```bash
curl -X POST https://your-app.vercel.app/api/weekly-report \
  -H "Authorization: Bearer your-cron-secret"
```

`your-cron-secret`을 실제 `CRON_SECRET` 환경 변수 값으로 교체하세요.
