import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { infoEmbed, errorEmbed } from '../utils/embeds';
import { getCurrentYearMonth, formatSlotTime, DAY_NAMES } from '../utils/time';

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
  )
  .addSubcommand((sub) =>
    sub.setName('enrollment').setDescription('View who is enrolled in each slot and day')
  );

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === 'warnings') {
    await handleWarnings(interaction, prisma, guildId);
  } else if (subcommand === 'attendance-report') {
    await handleReport(interaction, prisma, guildId);
  } else if (subcommand === 'enrollment') {
    await handleEnrollment(interaction, prisma, guildId);
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

async function handleEnrollment(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string
) {
  const slots = await prisma.slot.findMany({
    where: { guildId, active: true },
    orderBy: { startTime: 'asc' },
  });

  if (slots.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Enrollment', 'No active slots. Use `/slot add` to create one.')],
      ephemeral: true,
    });
    return;
  }

  const commitments = await prisma.memberCommitment.findMany({
    where: { guildId },
    orderBy: [{ slotId: 'asc' }, { dayOfWeek: 'asc' }],
  });

  // Group commitments: slotId → dayOfWeek → userId[]
  const bySlot = new Map<number, Map<number, string[]>>();
  for (const c of commitments) {
    if (!bySlot.has(c.slotId)) bySlot.set(c.slotId, new Map());
    const byDay = bySlot.get(c.slotId)!;
    const users = byDay.get(c.dayOfWeek) ?? [];
    users.push(c.userId);
    byDay.set(c.dayOfWeek, users);
  }

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('📋 Enrollment by Slot')
    .setTimestamp();

  let totalEnrolled = 0;

  for (const slot of slots) {
    const slotLabel = formatSlotTime(slot.startTime, slot.endTime);
    const byDay = bySlot.get(slot.id);

    if (!byDay || byDay.size === 0) {
      embed.addFields({ name: slotLabel, value: '_No members enrolled_', inline: false });
      continue;
    }

    const dayLines: string[] = [];
    // Iterate days in order Mon–Sun (1–7)
    for (let d = 1; d <= 7; d++) {
      const users = byDay.get(d);
      if (!users || users.length === 0) continue;
      totalEnrolled += users.length;
      const mentions = users.map((id) => `<@${id}>`).join(', ');
      dayLines.push(`**${DAY_NAMES[d]}** (${users.length}): ${mentions}`);
    }

    // Discord field value limit is 1024 chars — truncate gracefully
    let fieldValue = dayLines.join('\n');
    if (fieldValue.length > 1020) {
      fieldValue = fieldValue.slice(0, 1020) + '…';
    }

    embed.addFields({ name: slotLabel, value: fieldValue, inline: false });
  }

  embed.setFooter({ text: `${totalEnrolled} total enrollment(s) across all slots` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
