import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { successEmbed, infoEmbed } from '../utils/embeds';
import { isValidTimezone, nowInTz } from '../utils/time';
import { searchTimezones, formatTimezoneChoices } from '../utils/timezones';

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
  )
  .addSubcommand((sub) =>
    sub
      .setName('timezone')
      .setDescription('Set the server timezone for slot times')
      .addStringOption((opt) =>
        opt
          .setName('timezone')
          .setDescription('IANA timezone (e.g. America/New_York, Asia/Seoul)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

export async function autocomplete(interaction: AutocompleteInteraction, _prisma: PrismaClient) {
  const focused = interaction.options.getFocused();
  const results = searchTimezones(focused);
  await interaction.respond(formatTimezoneChoices(results));
}

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
  } else if (subcommand === 'timezone') {
    const tz = interaction.options.getString('timezone', true);

    if (!isValidTimezone(tz)) {
      await interaction.reply({
        embeds: [
          infoEmbed(
            'Invalid Timezone',
            `\`${tz}\` is not a valid IANA timezone.\n\nExamples: \`America/New_York\`, \`Europe/London\`, \`Asia/Seoul\`, \`UTC\``
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { timezone: tz },
      create: { guildId, timezone: tz },
    });

    const now = nowInTz(tz);
    await interaction.reply({
      embeds: [
        successEmbed(
          'Server Timezone Set',
          `Server timezone has been set to **${tz}**.\nCurrent time there: **${now.toFormat('HH:mm (cccc)')}**\n\nAll slot times are interpreted in this timezone.`
        ),
      ],
      ephemeral: true,
    });
  }
}
