import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AutocompleteInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds';
import { formatSlotTimeForUser, DAY_NAMES, DAY_SHORT } from '../utils/time';
import { getGuildTimezone, getUserTimezone } from '../utils/db';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Manage your study schedule')
  .addSubcommand((sub) => sub.setName('set').setDescription('Add or update a slot in your schedule'))
  .addSubcommand((sub) => sub.setName('view').setDescription('View your current schedule'))
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Unenroll from a specific slot')
      .addIntegerOption((opt) =>
        opt
          .setName('slot')
          .setDescription('The slot to remove from your schedule')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) => sub.setName('clear').setDescription('Clear your entire schedule'));

export async function autocomplete(interaction: AutocompleteInteraction, prisma: PrismaClient) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const commitments = await prisma.memberCommitment.findMany({
    where: { guildId, userId },
    include: { slot: true },
    distinct: ['slotId'],
    orderBy: { slot: { startTime: 'asc' } },
  });

  const seen = new Set<number>();
  const options: { name: string; value: number }[] = [];

  for (const c of commitments) {
    if (!seen.has(c.slotId) && c.slot.active) {
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

  if (subcommand === 'set') {
    await handleSet(interaction, prisma, guildId, userId);
  } else if (subcommand === 'view') {
    await handleView(interaction, prisma, guildId, userId);
  } else if (subcommand === 'remove') {
    await handleRemove(interaction, prisma, guildId, userId);
  } else if (subcommand === 'clear') {
    await handleClear(interaction, prisma, guildId, userId);
  }
}

async function handleSet(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const slots = await prisma.slot.findMany({
    where: { guildId, active: true },
    orderBy: { startTime: 'asc' },
  });

  if (slots.length === 0) {
    await interaction.reply({
      embeds: [errorEmbed('No Slots', 'There are no active study slots. Ask an admin to add some.')],
      ephemeral: true,
    });
    return;
  }

  const existingCommitments = await prisma.memberCommitment.findMany({
    where: { guildId, userId },
    orderBy: { dayOfWeek: 'asc' },
  });

  const enrolledDaysBySlot = new Map<number, number[]>();
  for (const c of existingCommitments) {
    const list = enrolledDaysBySlot.get(c.slotId) ?? [];
    list.push(c.dayOfWeek);
    enrolledDaysBySlot.set(c.slotId, list);
  }

  const allEnrollments = await prisma.memberCommitment.groupBy({
    by: ['slotId', 'dayOfWeek'],
    where: { guildId },
    _count: { dayOfWeek: true },
    orderBy: [{ slotId: 'asc' }, { dayOfWeek: 'asc' }],
  });

  const enrollCountMap = new Map<number, Map<number, number>>();
  for (const e of allEnrollments) {
    if (!enrollCountMap.has(e.slotId)) enrollCountMap.set(e.slotId, new Map());
    enrollCountMap.get(e.slotId)!.set(e.dayOfWeek, e._count.dayOfWeek);
  }

  const summaryLines: string[] = [];
  for (const s of slots) {
    const slotLabel = formatSlotTimeForUser(s.startTime, s.endTime, guildTz, userTz);
    const dayMap = enrollCountMap.get(s.id);
    if (!dayMap || dayMap.size === 0) {
      summaryLines.push(`**${slotLabel}**\n_No enrollments yet_`);
    } else {
      const counts: string[] = [];
      for (let d = 1; d <= 7; d++) {
        const count = dayMap.get(d);
        if (count) counts.push(`${DAY_SHORT[d]}: **${count}**`);
      }
      summaryLines.push(`**${slotLabel}**\n${counts.join(' · ')}`);
    }
  }
  const enrollmentEmbed = infoEmbed('📊 Current Enrollment', summaryLines.join('\n\n'));

  const slotMenu = new StringSelectMenuBuilder()
    .setCustomId('schedule_slot')
    .setPlaceholder('Pick one or more slots')
    .setMinValues(1)
    .setMaxValues(Math.min(slots.length, 25))
    .addOptions(
      slots.map((s) => {
        const userDays = enrolledDaysBySlot.get(s.id);
        const userPart = userDays && userDays.length > 0
          ? `You: ${userDays.map((d) => DAY_SHORT[d]).join(', ')}`
          : 'Not enrolled';
        const dayMap = enrollCountMap.get(s.id);
        const total = dayMap ? [...dayMap.values()].reduce((a, b) => a + b, 0) : 0;
        const desc = `${total} enrolled · ${userPart}`;
        return {
          label: formatSlotTimeForUser(s.startTime, s.endTime, guildTz, userTz),
          value: s.id.toString(),
          description: desc.slice(0, 100),
        };
      })
    );

  const slotRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(slotMenu);
  const reply = await interaction.reply({
    content: '**Step 1/2:** Pick the slot(s) you want to add days to:',
    embeds: [enrollmentEmbed],
    components: [slotRow],
    ephemeral: true,
  });

  try {
    const slotResponse = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === userId,
      time: 60_000,
    });

    const selectedSlotIds = slotResponse.values.map(Number);
    const selectedSlots = slots.filter((s) => selectedSlotIds.includes(s.id));

    if (selectedSlots.length === 0) {
      await slotResponse.update({
        content: 'Invalid selection. Please use `/schedule set` to try again.',
        components: [],
      });
      return;
    }

    const slotLabels = selectedSlots.map(
      (s) => formatSlotTimeForUser(s.startTime, s.endTime, guildTz, userTz)
    );

    const currentDaysSummary = selectedSlots.map((s) => {
      const days = enrolledDaysBySlot.get(s.id);
      const label = formatSlotTimeForUser(s.startTime, s.endTime, guildTz, userTz);
      return days && days.length > 0
        ? `**${label}**: ${days.sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ')}`
        : `**${label}**: not enrolled`;
    }).join('\n');

    const dayMenu = new StringSelectMenuBuilder()
      .setCustomId('schedule_days')
      .setPlaceholder('Select days to add')
      .setMinValues(1)
      .setMaxValues(7)
      .addOptions(
        [1, 2, 3, 4, 5, 6, 7].map((d) => ({
          label: DAY_NAMES[d],
          value: d.toString(),
        }))
      );

    const dayRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dayMenu);
    await slotResponse.update({
      content: `**Step 2/2:** Select days to **add** for **${slotLabels.join(', ')}**\nExisting days will be kept.\n\n${currentDaysSummary}`,
      components: [dayRow],
    });

    const dayResponse = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === userId,
      time: 60_000,
    });

    const selectedDays = dayResponse.values.map(Number);

    await prisma.$transaction(async (tx) => {
      for (const slotId of selectedSlotIds) {
        const existing = new Set(
          (await tx.memberCommitment.findMany({
            where: { guildId, userId, slotId },
            select: { dayOfWeek: true },
          })).map((c) => c.dayOfWeek)
        );
        const newDays = selectedDays.filter((d) => !existing.has(d));
        if (newDays.length > 0) {
          await tx.memberCommitment.createMany({
            data: newDays.map((day) => ({
              guildId,
              userId,
              slotId,
              dayOfWeek: day,
            })),
          });
        }
      }
    });

    const resultLines: string[] = [];
    for (const s of selectedSlots) {
      const allDays = await prisma.memberCommitment.findMany({
        where: { guildId, userId, slotId: s.id },
        orderBy: { dayOfWeek: 'asc' },
      });
      const label = formatSlotTimeForUser(s.startTime, s.endTime, guildTz, userTz);
      const dayStr = allDays.map((d) => DAY_SHORT[d.dayOfWeek]).join(', ');
      resultLines.push(`**${label}** — ${dayStr}`);
    }

    const confirmEmbed = successEmbed(
      'Schedule Updated',
      `${resultLines.join('\n')}\n\nRun \`/schedule view\` to see your full schedule.\nUse \`/schedule remove\` to unenroll from a slot.`
    );

    await dayResponse.update({
      content: null,
      embeds: [confirmEmbed],
      components: [],
    });
  } catch {
    await interaction.editReply({
      content: 'Selection timed out. Use `/schedule set` to try again.',
      components: [],
    });
  }
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const commitments = await prisma.memberCommitment.findMany({
    where: { guildId, userId },
    include: { slot: true },
    orderBy: [{ slot: { startTime: 'asc' } }, { dayOfWeek: 'asc' }],
  });

  if (commitments.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Your Schedule', 'You have no commitments. Use `/schedule set` to get started.')],
      ephemeral: true,
    });
    return;
  }

  const bySlot = new Map<number, { label: string; days: number[] }>();
  for (const c of commitments) {
    const existing = bySlot.get(c.slotId);
    if (existing) {
      existing.days.push(c.dayOfWeek);
    } else {
      bySlot.set(c.slotId, {
        label: formatSlotTimeForUser(c.slot.startTime, c.slot.endTime, guildTz, userTz),
        days: [c.dayOfWeek],
      });
    }
  }

  const lines: string[] = [];
  for (const { label, days } of bySlot.values()) {
    const dayLabels = days.sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ');
    lines.push(`**${label}** — ${dayLabels}`);
  }

  await interaction.reply({
    embeds: [infoEmbed('Your Schedule', lines.join('\n'))],
    ephemeral: true,
  });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const slotId = interaction.options.getInteger('slot', true);
  const guildTz = await getGuildTimezone(prisma, guildId);
  const userTz = await getUserTimezone(prisma, userId, guildTz);

  const slot = await prisma.slot.findFirst({ where: { id: slotId, guildId } });
  if (!slot) {
    await interaction.reply({
      embeds: [errorEmbed('Not Found', 'That slot was not found.')],
      ephemeral: true,
    });
    return;
  }

  const deleted = await prisma.memberCommitment.deleteMany({
    where: { guildId, userId, slotId },
  });

  const slotLabel = formatSlotTimeForUser(slot.startTime, slot.endTime, guildTz, userTz);

  if (deleted.count === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Not Enrolled', `You were not enrolled in **${slotLabel}**.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        'Slot Removed',
        `You have been unenrolled from **${slotLabel}**.\nYour other slots are unchanged.`
      ),
    ],
    ephemeral: true,
  });
}

async function handleClear(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
  guildId: string,
  userId: string
) {
  const count = await prisma.memberCommitment.count({ where: { guildId, userId } });
  if (count === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Nothing to Clear', 'You have no commitments.')],
      ephemeral: true,
    });
    return;
  }

  const confirmBtn = new ButtonBuilder()
    .setCustomId('schedule_clear_confirm')
    .setLabel('Yes, clear my entire schedule')
    .setStyle(ButtonStyle.Danger);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('schedule_clear_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

  const reply = await interaction.reply({
    content: `Are you sure you want to clear all ${count} commitment(s) across all slots?`,
    components: [row],
    ephemeral: true,
  });

  try {
    const btnResponse = await reply.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === userId,
      time: 30_000,
    });

    if (btnResponse.customId === 'schedule_clear_confirm') {
      await prisma.memberCommitment.deleteMany({ where: { guildId, userId } });
      await btnResponse.update({
        content: null,
        embeds: [successEmbed('Schedule Cleared', 'All your commitments have been removed.')],
        components: [],
      });
    } else {
      await btnResponse.update({ content: 'Cancelled.', components: [] });
    }
  } catch {
    await interaction.editReply({ content: 'Timed out.', components: [] });
  }
}
