import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { successEmbed, infoEmbed } from '../utils/embeds';
import { nowInTz, isValidTimezone } from '../utils/time';
import { searchTimezones, formatTimezoneChoices } from '../utils/timezones';

export const data = new SlashCommandBuilder()
  .setName('timezone')
  .setDescription('Manage your timezone preference')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set your preferred timezone')
      .addStringOption((opt) =>
        opt
          .setName('timezone')
          .setDescription('IANA timezone (e.g. America/New_York, Asia/Seoul)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('View your current timezone setting')
  );

export async function autocomplete(interaction: AutocompleteInteraction, _prisma: PrismaClient) {
  const focused = interaction.options.getFocused();
  const results = searchTimezones(focused);
  await interaction.respond(formatTimezoneChoices(results));
}

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (subcommand === 'set') {
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

    await prisma.userPreference.upsert({
      where: { userId },
      update: { timezone: tz },
      create: { userId, timezone: tz },
    });

    const now = nowInTz(tz);
    await interaction.reply({
      embeds: [
        successEmbed(
          'Timezone Updated',
          `Your timezone has been set to **${tz}**.\nCurrent time there: **${now.toFormat('HH:mm (cccc)')}**`
        ),
      ],
      ephemeral: true,
    });
  } else if (subcommand === 'view') {
    const pref = await prisma.userPreference.findUnique({ where: { userId } });

    if (!pref) {
      await interaction.reply({
        embeds: [
          infoEmbed(
            'No Timezone Set',
            'You haven\'t set a timezone preference yet. Times will be shown in the server\'s timezone.\n\nUse `/timezone set` to set your preference.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const now = nowInTz(pref.timezone);
    await interaction.reply({
      embeds: [
        infoEmbed(
          'Your Timezone',
          `**Timezone:** ${pref.timezone}\n**Current time:** ${now.toFormat('HH:mm (cccc)')}`
        ),
      ],
      ephemeral: true,
    });
  }
}
