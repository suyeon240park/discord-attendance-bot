# Study Group Attendance Bot

A Discord bot that automatically tracks attendance for recurring morning study sessions. Members commit to time slots and days, and the bot checks voice channel presence at each session start.

## Features

- Admin-defined study slots (e.g., `06:00-07:00`, `07:00-08:00`)
- Members choose their recurring slots and days freely
- Automatic attendance check via voice channel presence at session start
- Leave notice system (must submit at least 1 hour before session)
- Monthly warning system with 5-warning threshold alerts
- Full attendance reporting

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

### Member Commands

| Command | Description |
|---|---|
| `/schedule set` | Set your recurring study schedule (pick slots and days interactively) |
| `/schedule view` | View your current commitments |
| `/schedule clear` | Remove all your commitments |
| `/leave submit <date> <slot>` | Submit a leave notice (`YYYY-MM-DD`, at least 1 hour before session) |
| `/leave list` | View your upcoming leave notices |
| `/warnings` | View your own warning count for the current month |

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
