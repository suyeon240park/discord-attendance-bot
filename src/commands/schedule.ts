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
import { formatSlotTime, DAY_NAMES, DAY_SHORT } from '../utils/time';

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
        name: formatSlotTime(c.slot.startTime, c.slot.endTime),
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

  // Fetch existing enrollment for all slots so descriptions can show current days
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

  // Step 1: pick ONE slot to configure
  const slotMenu = new StringSelectMenuBuilder()
    .setCustomId('schedule_slot')
    .setPlaceholder('Pick a slot to configure')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      slots.map((s) => {
        const days = enrolledDaysBySlot.get(s.id);
        const desc = days && days.length > 0
          ? `Enrolled: ${days.map((d) => DAY_SHORT[d]).join(', ')}`
          : 'Not enrolled';
        return {
          label: formatSlotTime(s.startTime, s.endTime),
          value: s.id.toString(),
          description: desc,
        };
      })
    );

  const slotRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(slotMenu);
  const reply = await interaction.reply({
    content: '**Step 1/2:** Pick the slot you want to configure:',
    components: [slotRow],
    ephemeral: true,
  });

  try {
    const slotResponse = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === userId,
      time: 60_000,
    });

    const selectedSlotId = Number(slotResponse.values[0]);
    const selectedSlot = slots.find((s) => s.id === selectedSlotId);

    if (!selectedSlot) {
      await slotResponse.update({
        content: 'Invalid selection. Please use `/schedule set` to try again.',
        components: [],
      });
      return;
    }

    const currentDays = enrolledDaysBySlot.get(selectedSlotId);
    const currentLabel = currentDays && currentDays.length > 0
      ? `Currently enrolled on: **${currentDays.map((d) => DAY_NAMES[d]).join(', ')}**`
      : 'You are not currently enrolled in this slot.';

    // Step 2: pick days for that slot
    const dayMenu = new StringSelectMenuBuilder()
      .setCustomId('schedule_days')
      .setPlaceholder('Select days for this slot')
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
      content: `**Step 2/2:** Choose days for **${formatSlotTime(selectedSlot.startTime, selectedSlot.endTime)}**\n${currentLabel}`,
      components: [dayRow],
    });

    const dayResponse = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === userId,
      time: 60_000,
    });

    const selectedDays = dayResponse.values.map(Number);

    // Only replace commitments for this specific slot — other slots are untouched
    await prisma.$transaction(async (tx) => {
      await tx.memberCommitment.deleteMany({ where: { guildId, userId, slotId: selectedSlotId } });
      await tx.memberCommitment.createMany({
        data: selectedDays.map((day) => ({
          guildId,
          userId,
          slotId: selectedSlotId,
          dayOfWeek: day,
        })),
      });
    });

    const dayLabels = selectedDays
      .sort((a, b) => a - b)
      .map((d) => DAY_SHORT[d])
      .join(', ');

    await dayResponse.update({
      content: null,
      embeds: [
        successEmbed(
          'Schedule Updated',
          `**Slot:** ${formatSlotTime(selectedSlot.startTime, selectedSlot.endTime)}\n**Days:** ${dayLabels}\n\nOther slots in your schedule are unchanged. Run \`/schedule view\` to see your full schedule.`
        ),
      ],
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

  // Group by slot, show days for each
  const bySlot = new Map<number, { label: string; days: number[] }>();
  for (const c of commitments) {
    const existing = bySlot.get(c.slotId);
    if (existing) {
      existing.days.push(c.dayOfWeek);
    } else {
      bySlot.set(c.slotId, {
        label: formatSlotTime(c.slot.startTime, c.slot.endTime),
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

  if (deleted.count === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Not Enrolled', `You were not enrolled in **${formatSlotTime(slot.startTime, slot.endTime)}**.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        'Slot Removed',
        `You have been unenrolled from **${formatSlotTime(slot.startTime, slot.endTime)}**.\nYour other slots are unchanged.`
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
