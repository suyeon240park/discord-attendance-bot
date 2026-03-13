import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { infoEmbed, errorEmbed } from '../utils/embeds';
import { getCurrentYearMonth, formatSlotTime } from '../utils/time';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin tools')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('warnings')
      .setDescription("View a member's warning count for the current month")
      .addUserOption((opt) => opt.setName('user').setDescription('The member to check').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('attendance-report')
      .setDescription('View attendance summary for all members')
      .addStringOption((opt) =>
        opt.setName('month').setDescription('Month in YYYY-MM format (defaults to current)').setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === 'warnings') {
    await handleWarnings(interaction, prisma, guildId);
  } else if (subcommand === 'attendance-report') {
    await handleReport(interaction, prisma, guildId);
  }
}

async function handleWarnings(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string
) {
  const user = interaction.options.getUser('user', true);
  const month = getCurrentYearMonth();

  const absences = await prisma.attendanceRecord.findMany({
    where: {
      guildId,
      userId: user.id,
      status: 'absent',
      date: { startsWith: month },
    },
    include: { slot: true },
    orderBy: { date: 'asc' },
  });

  const warningCount = absences.length;

  let description = `**Member:** <@${user.id}>\n**Month:** ${month}\n**Warnings:** ${warningCount}`;

  if (absences.length > 0) {
    const details = absences.map(
      (a) => `${a.date} — ${formatSlotTime(a.slot.startTime, a.slot.endTime)}`
    );
    description += '\n\n**Absence details:**\n' + details.join('\n');
  }

  await interaction.reply({
    embeds: [infoEmbed('Warning Report', description)],
    ephemeral: true,
  });
}

async function handleReport(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string
) {
  const month = interaction.options.getString('month') ?? getCurrentYearMonth();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Month', 'Use YYYY-MM format (e.g. 2026-03)')],
      ephemeral: true,
    });
    return;
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { guildId, date: { startsWith: month } },
  });

  if (records.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Attendance Report', `No attendance records found for ${month}.`)],
      ephemeral: true,
    });
    return;
  }

  const stats = new Map<string, { present: number; absent: number; onLeave: number }>();

  for (const r of records) {
    const s = stats.get(r.userId) ?? { present: 0, absent: 0, onLeave: 0 };
    if (r.status === 'present') s.present++;
    else if (r.status === 'absent') s.absent++;
    else if (r.status === 'on_leave') s.onLeave++;
    stats.set(r.userId, s);
  }

  const lines: string[] = [];
  for (const [userId, s] of stats) {
    const total = s.present + s.absent + s.onLeave;
    lines.push(
      `<@${userId}> — Present: ${s.present} | Absent: ${s.absent} | Leave: ${s.onLeave} | Total: ${total}`
    );
  }

  const description = `**Month:** ${month}\n\n${lines.join('\n')}`;
  await interaction.reply({
    embeds: [infoEmbed('Attendance Report', description)],
    ephemeral: true,
  });
}
