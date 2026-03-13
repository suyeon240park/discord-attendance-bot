import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { successEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure bot settings (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('voice-channel')
      .setDescription('Set the required attendance voice channel')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The voice channel to monitor')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('announcement-channel')
      .setDescription('Set the announcement text channel')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The text channel for announcements')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === 'voice-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { voiceChannelId: channel.id },
      create: { guildId, voiceChannelId: channel.id },
    });
    await interaction.reply({
      embeds: [successEmbed('Voice Channel Set', `Attendance will be tracked in <#${channel.id}>`)],
      ephemeral: true,
    });
  } else if (subcommand === 'announcement-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { announcementChannelId: channel.id },
      create: { guildId, announcementChannelId: channel.id },
    });
    await interaction.reply({
      embeds: [successEmbed('Announcement Channel Set', `Announcements will be posted in <#${channel.id}>`)],
      ephemeral: true,
    });
  }
}
