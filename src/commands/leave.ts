import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds';
import { formatSlotTimeForUser, nowInTz, getTodayDate } from '../utils/time';
import { getGuildTimezone, getUserTimezone } from '../utils/db';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Manage leave notices')
  .addSubcommand((sub) =>
    sub
      .setName('submit')
      .setDescription('Submit a leave notice for a session')
      .addStringOption((opt) =>
        opt.setName('date').setDescription('Date in YYYY-MM-DD format').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('slot').setDescription('The slot to take leave from').setRequired(true).setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for leave (optional)').setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('View your upcoming leave notices'));

export async function autocomplete(interaction: AutocompleteInteraction, prisma: PrismaClient) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const commitments = await prisma.memberCommitment.findMany({
    where: { guildId, userId },
    include: { slot: true },
    distinct: ['slotId'],
  });

  const seen = new Set<number>();
  const options: { name: string; value: number }[] = [];

  for (const c of commitments) {
    if (!seen.has(c.slotId)) {
      seen.add(c.slotId);
      options.push({
        name: formatSlotTimeForUser(c.slot.startTime, c.slot.endTime, guildTz, userTz),
        value: c.slotId,
      });
    }
  }

  await interaction.respond(options);
}

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (subcommand === 'submit') {
    await handleSubmit(interaction, prisma, guildId, userId);
  } else if (subcommand === 'list') {
    await handleList(interaction, prisma, guildId, userId);
  }
}

async function handleSubmit(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const dateStr = interaction.options.getString('date', true);
  const slotId = interaction.options.getInteger('slot', true);
  const reason = interaction.options.getString('reason');

  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const parsedDate = DateTime.fromISO(dateStr, { zone: guildTz });
  if (!parsedDate.isValid) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Date', 'Use YYYY-MM-DD format (e.g. 2026-03-15)')],
      ephemeral: true,
    });
    return;
  }

  const now = nowInTz(guildTz);
  const todayStr = getTodayDate(guildTz);

  if (dateStr < todayStr) {
    await interaction.reply({
      embeds: [errorEmbed('Past Date', 'You cannot submit leave for a past date.')],
      ephemeral: true,
    });
    return;
  }

  const slot = await prisma.slot.findFirst({ where: { id: slotId, guildId, active: true } });
  if (!slot) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Slot', 'That slot does not exist or is inactive.')],
      ephemeral: true,
    });
    return;
  }

  const dayOfWeek = parsedDate.weekday;
  const commitment = await prisma.memberCommitment.findFirst({
    where: { guildId, userId, slotId, dayOfWeek },
  });

  if (!commitment) {
    await interaction.reply({
      embeds: [errorEmbed('No Commitment', `You are not committed to this slot on ${parsedDate.toFormat('cccc')}s.`)],
      ephemeral: true,
    });
    return;
  }

  if (dateStr === todayStr) {
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const slotStart = now.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
    const diffMinutes = slotStart.diff(now, 'minutes').minutes;

    if (diffMinutes < 60) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            'Too Late',
            'Leave must be submitted at least 1 hour before the session start time.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }
  }

  try {
    await prisma.leaveNotice.create({
      data: { guildId, userId, slotId, date: dateStr, reason },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      await interaction.reply({
        embeds: [errorEmbed('Duplicate', 'You already have a leave notice for this session.')],
        ephemeral: true,
      });
      return;
    }
    throw err;
  }

  const slotLabel = formatSlotTimeForUser(slot.startTime, slot.endTime, guildTz, userTz, dateStr);

  await interaction.reply({
    embeds: [
      successEmbed(
        'Leave Submitted',
        `**Date:** ${dateStr} (${parsedDate.toFormat('cccc')})\n**Slot:** ${slotLabel}` +
          (reason ? `\n**Reason:** ${reason}` : '') +
          '\n\n*This notice cannot be edited or withdrawn.*'
      ),
    ],
    ephemeral: true,
  });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);
  const todayStr = getTodayDate(guildTz);

  const notices = await prisma.leaveNotice.findMany({
    where: { guildId, userId, date: { gte: todayStr } },
    include: { slot: true },
    orderBy: [{ date: 'asc' }, { slot: { startTime: 'asc' } }],
  });

  if (notices.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Your Leave Notices', 'No upcoming leave notices.')],
      ephemeral: true,
    });
    return;
  }

  const lines = notices.map((n) => {
    const dayName = DateTime.fromISO(n.date).toFormat('cccc');
    const slotLabel = formatSlotTimeForUser(n.slot.startTime, n.slot.endTime, guildTz, userTz, n.date);
    return `**${n.date}** (${dayName}) — ${slotLabel}${n.reason ? ` — _${n.reason}_` : ''}`;
  });

  await interaction.reply({
    embeds: [infoEmbed('Your Leave Notices', lines.join('\n'))],
    ephemeral: true,
  });
}
