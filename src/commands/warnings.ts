import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { infoEmbed } from '../utils/embeds';
import { getCurrentYearMonth } from '../utils/time';
import { getGuildTimezone } from '../utils/db';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View your warning count for the current month');

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const guildTz = await getGuildTimezone(prisma, guildId);
  const month = getCurrentYearMonth(guildTz);

  const count = await prisma.attendanceRecord.count({
    where: {
      guildId,
      userId,
      status: 'absent',
      date: { startsWith: month },
    },
  });

  await interaction.reply({
    embeds: [
      infoEmbed(
        'Your Warnings',
        `**Month:** ${month}\n**Warnings:** ${count} / 5`
      ),
    ],
    ephemeral: true,
  });
}
