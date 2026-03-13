import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds';
import { parseSlotTimeRange, formatSlotTime } from '../utils/time';

export const data = new SlashCommandBuilder()
  .setName('slot')
  .setDescription('Manage study slots (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a new study slot')
      .addStringOption((opt) =>
        opt
          .setName('time')
          .setDescription('Start–end time range, e.g. 06:00-07:00')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a study slot')
      .addIntegerOption((opt) =>
        opt.setName('slot').setDescription('Select a slot to remove').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('List all active study slots'));

export async function autocomplete(interaction: AutocompleteInteraction, prisma: PrismaClient) {
  const guildId = interaction.guildId!;
  const slots = await prisma.slot.findMany({
    where: { guildId, active: true },
    orderBy: { startTime: 'asc' },
  });
  await interaction.respond(
    slots.map((s) => ({
      name: formatSlotTime(s.startTime, s.endTime),
      value: s.id,
    }))
  );
}

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === 'add') {
    const raw = interaction.options.getString('time', true);
    const parsed = parseSlotTimeRange(raw);

    if (!parsed) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Format', 'Use `HH:MM-HH:MM` format with start before end (e.g. `06:00-07:00`).')],
        ephemeral: true,
      });
      return;
    }

    const { startTime, endTime } = parsed;

    const existing = await prisma.slot.findUnique({
      where: { guildId_startTime_endTime: { guildId, startTime, endTime } },
    });

    if (existing && existing.active) {
      await interaction.reply({
        embeds: [errorEmbed('Duplicate Slot', `Slot ${formatSlotTime(startTime, endTime)} already exists.`)],
        ephemeral: true,
      });
      return;
    }

    if (existing && !existing.active) {
      await prisma.slot.update({ where: { id: existing.id }, data: { active: true } });
    } else {
      await prisma.slot.create({ data: { guildId, startTime, endTime } });
    }

    await interaction.reply({
      embeds: [successEmbed('Slot Added', `${formatSlotTime(startTime, endTime)} is now active.`)],
    });
  } else if (subcommand === 'remove') {
    const slotId = interaction.options.getInteger('slot', true);
    const slot = await prisma.slot.findFirst({ where: { id: slotId, guildId, active: true } });

    if (!slot) {
      await interaction.reply({
        embeds: [errorEmbed('Not Found', 'That slot does not exist or is already removed.')],
        ephemeral: true,
      });
      return;
    }

    await prisma.slot.update({ where: { id: slotId }, data: { active: false } });

    const affected = await prisma.memberCommitment.findMany({ where: { slotId } });
    await prisma.memberCommitment.deleteMany({ where: { slotId } });

    const uniqueUsers = [...new Set(affected.map((c) => c.userId))];
    const mentions = uniqueUsers.map((id) => `<@${id}>`).join(', ');

    const description = uniqueUsers.length > 0
      ? `${formatSlotTime(slot.startTime, slot.endTime)} has been removed.\n\nAffected members: ${mentions}`
      : `${formatSlotTime(slot.startTime, slot.endTime)} has been removed. No members were affected.`;

    await interaction.reply({
      embeds: [successEmbed('Slot Removed', description)],
    });
  } else if (subcommand === 'list') {
    const slots = await prisma.slot.findMany({
      where: { guildId, active: true },
      orderBy: { startTime: 'asc' },
    });

    if (slots.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed('Study Slots', 'No active slots. Use `/slot add` to create one.')],
        ephemeral: true,
      });
      return;
    }

    const lines = slots.map((s, i) => `**${i + 1}.** ${formatSlotTime(s.startTime, s.endTime)} (ID: ${s.id})`);
    await interaction.reply({
      embeds: [infoEmbed('Active Study Slots', lines.join('\n'))],
    });
  }
}
