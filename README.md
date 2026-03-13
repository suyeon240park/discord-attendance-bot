# Study Group Attendance Bot

A Discord bot that automatically tracks attendance for recurring morning study sessions. Members commit to time slots and days, and the bot checks voice channel presence at each session start.

## Features

- Admin-defined study slots (e.g., `06:00-07:00`, `07:00-08:00`)
- Members choose their recurring slots and days freely
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
| `/slot add <time>` | Add a study slot — format: `HH:MM-HH:MM` (e.g. `06:00-07:00`) |
| `/slot remove <slot>` | Remove a slot — select from dropdown, no ID required |
| `/slot list` | List all active slots |
| `/admin warnings <user>` | View a member's absence warnings for the current month |
| `/admin attendance-report [month]` | View attendance summary (all members); optionally pass `YYYY-MM` |
| `/admin enrollment` | View who is enrolled in each slot, broken down by day |
| `/help` | Show all admin and member commands (admin sees both sections) |

### Member Commands

| Command | Description |
|---|---|
| `/schedule set` | Enroll in a slot — shows live enrollment counts per day before you pick |
| `/schedule remove` | Unenroll from a specific slot; other slots stay unchanged |
| `/schedule view` | View your current commitments grouped by slot |
| `/schedule clear` | Remove all your commitments across every slot |
| `/leave submit <date> <slot>` | Submit a leave notice (`YYYY-MM-DD`, at least 1 hour before session) |
| `/leave list` | View your upcoming leave notices |
| `/warnings` | View your own warning count for the current month |
| `/help` | Show all available member commands and attendance rules |

### How `/schedule set` works

1. Run `/schedule set` — an enrollment summary embed appears showing how many members are enrolled per slot per day before you make any selection.
2. Pick a slot from the dropdown. The dropdown description also shows the total enrolled count and your current days for that slot at a glance.
3. Choose which days to attend (Monday–Sunday). Select **None** to remove that slot from your schedule entirely.
4. After confirming, the bot shows the updated per-day enrollment count for that slot.

Each run of `/schedule set` configures one slot at a time. Your other slots are never affected.

## Attendance Rules

- At the exact session start time, the bot checks who is in the designated voice channel.
- Not in the channel = **absent** (no grace period; late = absent).
- Leave notice submitted 1+ hour before the session = **on leave** (not counted as absent).
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
