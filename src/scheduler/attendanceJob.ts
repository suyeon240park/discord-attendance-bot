import cron from 'node-cron';
import { Client, TextChannel, VoiceChannel } from 'discord.js';
import { PrismaClient, GuildConfig } from '@prisma/client';
import {
  getCurrentHHmm,
  getTodayDate,
  getISODayOfWeek,
  formatSlotTime,
  getCurrentYearMonth,
  nowInTz,
} from '../utils/time';

export function startAttendanceJob(client: Client, prisma: PrismaClient) {
  cron.schedule('* * * * *', async () => {
    try {
      await checkReminders(client, prisma);
      await checkAttendance(client, prisma);
    } catch (err) {
      console.error('[AttendanceJob] Error during scheduled check:', err);
    }
  });

  console.log('[AttendanceJob] Cron job started (every minute)');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveChannels(
  client: Client,
  guildConfig: GuildConfig
): Promise<{ voiceChannel: VoiceChannel; announcementChannel: TextChannel } | null> {
  const { voiceChannelId, announcementChannelId, guildId } = guildConfig;
  if (!voiceChannelId || !announcementChannelId) {
    console.warn(`[AttendanceJob] Guild ${guildId}: voice or announcement channel not configured`);
    return null;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  try {
    const vc = await guild.channels.fetch(voiceChannelId);
    const ac = await guild.channels.fetch(announcementChannelId);
    if (!vc || !(vc instanceof VoiceChannel)) return null;
    if (!ac || !(ac instanceof TextChannel)) return null;
    return { voiceChannel: vc, announcementChannel: ac };
  } catch {
    console.error(`[AttendanceJob] Could not fetch channels for guild ${guildId}`);
    return null;
  }
}

async function resolveAnnouncementChannel(
  client: Client,
  guildConfig: GuildConfig
): Promise<TextChannel | null> {
  const { announcementChannelId, guildId } = guildConfig;
  if (!announcementChannelId) return null;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  try {
    const ch = await guild.channels.fetch(announcementChannelId);
    return ch instanceof TextChannel ? ch : null;
  } catch {
    return null;
  }
}

// ─── 5-minute reminder ────────────────────────────────────────────────────────

async function checkReminders(client: Client, prisma: PrismaClient) {
  const reminderTime = nowInTz().plus({ minutes: 5 }).toFormat('HH:mm');
  const today = getTodayDate();
  const todayDow = getISODayOfWeek();

  const configs = await prisma.guildConfig.findMany();

  for (const guildConfig of configs) {
    const upcomingSlots = await prisma.slot.findMany({
      where: { guildId: guildConfig.guildId, startTime: reminderTime, active: true },
    });

    if (upcomingSlots.length === 0) continue;

    const announcementChannel = await resolveAnnouncementChannel(client, guildConfig);
    if (!announcementChannel) continue;

    for (const slot of upcomingSlots) {
      const commitments = await prisma.memberCommitment.findMany({
        where: { guildId: guildConfig.guildId, slotId: slot.id, dayOfWeek: todayDow },
      });

      if (commitments.length === 0) continue;

      // Exclude members who already submitted leave for this session
      const leaveUserIds = new Set(
        (
          await prisma.leaveNotice.findMany({
            where: {
              guildId: guildConfig.guildId,
              slotId: slot.id,
              date: today,
              userId: { in: commitments.map((c) => c.userId) },
            },
            select: { userId: true },
          })
        ).map((l) => l.userId)
      );

      const attending = commitments.filter((c) => !leaveUserIds.has(c.userId));
      if (attending.length === 0) continue;

      const mentions = attending.map((c) => `<@${c.userId}>`).join(' ');
      const slotLabel = formatSlotTime(slot.startTime, slot.endTime);

      await announcementChannel.send(
        `🔔 **${slotLabel}** session starts in **5 minutes**!\n${mentions}`
      );
    }
  }
}

// ─── Session-start attendance check ──────────────────────────────────────────

async function checkAttendance(client: Client, prisma: PrismaClient) {
  const currentTime = getCurrentHHmm();
  const today = getTodayDate();
  const todayDow = getISODayOfWeek();
  const yearMonth = getCurrentYearMonth();

  const configs = await prisma.guildConfig.findMany();

  for (const guildConfig of configs) {
    const matchingSlots = await prisma.slot.findMany({
      where: { guildId: guildConfig.guildId, startTime: currentTime, active: true },
    });

    if (matchingSlots.length === 0) continue;

    const channels = await resolveChannels(client, guildConfig);
    if (!channels) continue;

    const { voiceChannel, announcementChannel } = channels;
    const presentUserIds = new Set(voiceChannel.members.map((m) => m.id));

    for (const slot of matchingSlots) {
      const commitments = await prisma.memberCommitment.findMany({
        where: { guildId: guildConfig.guildId, slotId: slot.id, dayOfWeek: todayDow },
      });

      if (commitments.length === 0) continue;

      const slotLabel = formatSlotTime(slot.startTime, slot.endTime);

      // Collect statuses
      const presentIds: string[] = [];
      const absentResults: { userId: string; warningCount: number }[] = [];
      const fiveWarningIds: string[] = [];

      for (const commitment of commitments) {
        const { userId } = commitment;

        const leaveNotice = await prisma.leaveNotice.findUnique({
          where: {
            guildId_userId_slotId_date: {
              guildId: guildConfig.guildId,
              userId,
              slotId: slot.id,
              date: today,
            },
          },
        });

        let status: string;
        if (leaveNotice) {
          status = 'on_leave';
        } else if (presentUserIds.has(userId)) {
          status = 'present';
        } else {
          status = 'absent';
        }

        await prisma.attendanceRecord.upsert({
          where: {
            guildId_userId_slotId_date: {
              guildId: guildConfig.guildId,
              userId,
              slotId: slot.id,
              date: today,
            },
          },
          create: { guildId: guildConfig.guildId, userId, slotId: slot.id, date: today, status },
          update: {},
        });

        if (status === 'present') {
          presentIds.push(userId);
        } else if (status === 'absent') {
          const warningCount = await prisma.attendanceRecord.count({
            where: {
              guildId: guildConfig.guildId,
              userId,
              status: 'absent',
              date: { startsWith: yearMonth },
            },
          });
          absentResults.push({ userId, warningCount });
          if (warningCount === 5) fiveWarningIds.push(userId);
        }
      }

      // ── Session started message ──
      if (presentIds.length > 0) {
        const mentions = presentIds.map((id) => `<@${id}>`).join(' ');
        await announcementChannel.send(
          `✅ **${slotLabel}** session has started!\n🎉 Great work showing up: ${mentions}`
        );
      } else {
        await announcementChannel.send(
          `✅ **${slotLabel}** session has started! (No members present)`
        );
      }

      // ── Absence summary ──
      if (absentResults.length > 0) {
        const lines = absentResults.map(
          ({ userId, warningCount }) =>
            `• <@${userId}> — **${warningCount}** warning${warningCount !== 1 ? 's' : ''}`
        );
        await announcementChannel.send(
          `⚠️ Absent from **${slotLabel}** on **${today}**:\n${lines.join('\n')}`
        );
      }

      // ── 5-warning alerts ──
      for (const userId of fiveWarningIds) {
        await announcementChannel.send(
          `🚨 <@${userId}> has reached **5 warnings** this month (${yearMonth}). This member will be evicted from the server.`
        );
      }
    }
  }
}

// ─── Startup: missed-session recovery ────────────────────────────────────────

export async function checkMissedSessions(client: Client, prisma: PrismaClient) {
  const today = getTodayDate();
  const currentTime = getCurrentHHmm();
  const todayDow = getISODayOfWeek();

  const configs = await prisma.guildConfig.findMany();

  for (const guildConfig of configs) {
    const pastSlots = await prisma.slot.findMany({
      where: {
        guildId: guildConfig.guildId,
        active: true,
        startTime: { lt: currentTime },
      },
    });

    let newlyMissed = 0;

    for (const slot of pastSlots) {
      const commitments = await prisma.memberCommitment.findMany({
        where: { guildId: guildConfig.guildId, slotId: slot.id, dayOfWeek: todayDow },
      });

      for (const commitment of commitments) {
        const existing = await prisma.attendanceRecord.findUnique({
          where: {
            guildId_userId_slotId_date: {
              guildId: guildConfig.guildId,
              userId: commitment.userId,
              slotId: slot.id,
              date: today,
            },
          },
        });

        if (!existing) {
          await prisma.attendanceRecord.create({
            data: {
              guildId: guildConfig.guildId,
              userId: commitment.userId,
              slotId: slot.id,
              date: today,
              status: 'missed_check',
            },
          });
          newlyMissed++;
        }
      }
    }

    if (newlyMissed > 0) {
      const announcementChannel = await resolveAnnouncementChannel(client, guildConfig);
      if (announcementChannel) {
        await announcementChannel.send(
          `⚠️ **Bot was offline.** ${newlyMissed} attendance record(s) were missed and have been marked as \`missed_check\` (not counted as absences).`
        );
      }
    }
  }
}
