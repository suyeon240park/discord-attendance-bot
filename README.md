# Study Group Attendance Bot

A Discord bot that automatically tracks attendance for recurring study sessions. Members commit to time slots and days, and the bot checks voice channel presence at each session start.

## Features

- Admin-defined study slots (e.g., `06:00-07:00`, `07:00-08:00`)
- Members choose their recurring slots and days freely
- Multi-slot enrollment — pick several slots and days in a single command
- Additive scheduling — add new days without losing existing ones
- Per-guild timezone configuration (slots are defined in the server's timezone)
- Per-user timezone preferences — times are shown in your local timezone in personal responses
- Public notifications use Discord dynamic timestamps, so every member sees times in their own timezone automatically
- Live enrollment counts per slot and day visible before committing
- Automatic attendance check via voice channel presence at session start
- 5-minute reminder before each session, with a roll call when it starts
- Leave notice system (must submit at least 1 hour before session)
- Monthly warning system with 5-warning threshold alerts
- Full attendance reporting
- Built-in `/help` command with role-aware instructions

## Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** and create a bot
4. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
5. Copy the bot token

### 2. Invite the Bot

Generate an invite URL with these settings:
- **Scopes:** `bot`, `applications.commands`
- **Permissions:** Send Messages, View Channels, Connect
- **Link:** https://discord.com/oauth2/authorize?client_id=1481820823986638969&scope=bot%20applications.commands&permissions=8

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env`:
- `DISCORD_TOKEN` — Your bot token (Developer Portal → Bot → Token)
- `DISCORD_CLIENT_ID` — Application ID (Developer Portal → General Information)

### 4. Install and Run

```bash
npm install
npx prisma db push
npm run deploy-commands
npm run dev
```

> **Note:** Commands are deployed **globally**, so the first deployment can take up to 1 hour to appear in all servers. Re-deploying after command changes propagates faster.

### 5. Initial Bot Configuration

Run these commands in your Discord server (requires Administrator):

```
/config voice-channel channel:#your-study-voice-channel
/config announcement-channel channel:#your-announcements-channel
/config timezone timezone:America/New_York
/slot add time:06:00-07:00
/slot add time:07:00-08:00
/slot add time:08:00-09:00
/slot add time:09:00-10:00
```

## Commands

### Admin Commands

| Command | Description |
|---|---|
| `/config voice-channel <channel>` | Set the required attendance voice channel |
| `/config announcement-channel <channel>` | Set the channel where absence alerts are posted |
| `/config timezone <timezone>` | Set the server timezone (IANA format, e.g. `America/New_York`, `Asia/Seoul`) |
| `/slot add <time>` | Add a study slot — format: `HH:MM-HH:MM` (e.g. `06:00-07:00`) in server timezone |
| `/slot remove <slot>` | Remove a slot — select from dropdown, no ID required |
| `/slot list` | List all active slots |
| `/admin warnings <user>` | View a member's absence warnings for the current month |
| `/admin attendance-report [month]` | View attendance summary (all members); optionally pass `YYYY-MM` |
| `/admin enrollment` | View who is enrolled in each slot, broken down by day |
| `/help` | Show all admin and member commands (admin sees both sections) |

### Member Commands

| Command | Description |
|---|---|
| `/schedule set` | Enroll in one or more slots — shows live enrollment counts, lets you pick multiple slots and days at once |
| `/schedule remove` | Unenroll from a specific slot; other slots stay unchanged |
| `/schedule view` | View your current commitments grouped by slot (shown in your timezone) |
| `/schedule clear` | Remove all your commitments across every slot |
| `/timezone set <timezone>` | Set your personal timezone (IANA format, e.g. `Asia/Seoul`, `Europe/London`) |
| `/timezone view` | View your current timezone setting |
| `/leave submit <date> <slot>` | Submit a leave notice (`YYYY-MM-DD`, anytime before the session date) |
| `/leave list` | View your upcoming leave notices |
| `/warnings` | View your own warning count for the current month |
| `/help` | Show all available member commands and attendance rules |

### How `/schedule set` works

1. Run `/schedule set` — an enrollment summary embed appears showing how many members are enrolled per slot per day.
2. Pick one or more slots from the dropdown. The description shows total enrolled count and your current days per slot.
3. Choose which days to add (Monday–Sunday). Selected days are **added** to your existing enrollment — days you already have are kept, not replaced.
4. After confirming, the bot shows your final schedule for the selected slots.

To remove days or unenroll from a slot, use `/schedule remove`.

### Timezone support

Slot times are always stored in the **server timezone** (set by an admin via `/config timezone`). Members can set their own timezone with `/timezone set`, and all bot command responses will show times converted to their preference. All times are displayed in 12-hour AM/PM format.

Public messages — reminders, session-started announcements, and absence alerts — use Discord's dynamic timestamp format (`<t:UNIX:t>`), which automatically displays in every viewer's local timezone based on their device settings. The `/timezone set` preference only affects bot command responses, not Discord's rendering of public timestamps.

## Attendance Rules

- At the exact session start time, the bot checks who is in the designated voice channel.
- Not in the channel = **absent** (no grace period; late = absent).
- Leave notice submitted before the session = **on leave** (not counted as absent).
- Leave notices are **one-way** — they cannot be edited or withdrawn after submission.
- **5 absences in a calendar month** triggers a public alert in the announcement channel.
- Warning counts reset automatically at the start of each month.

## Production Deployment

```bash
npm run build
pm2 start ecosystem.config.js
```

## Database

SQLite, stored at `dev.db`. Back it up by copying that file. To open a visual browser:

```bash
npx prisma studio
```
