import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show available commands');

export async function execute(interaction: ChatInputCommandInteraction, _prisma: PrismaClient) {
  // Prefer GuildMember.permissions (fully resolved) over interaction.memberPermissions
  // to correctly handle cached vs. API member objects.
  const isAdmin =
    interaction.member instanceof GuildMember
      ? interaction.member.permissions.has(PermissionFlagsBits.Administrator)
      : (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false);

  const memberEmbed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('📚 Member Commands')
    .addFields(
      {
        name: '`/schedule set`',
        value: 'Add or update a slot in your schedule. Pick the slot, then choose which days you want it. Run once per slot.',
      },
      {
        name: '`/schedule remove`',
        value: 'Unenroll from a specific slot. Your other slots stay unchanged.',
      },
      {
        name: '`/schedule view`',
        value: 'See your full schedule — all enrolled slots and their days.',
      },
      {
        name: '`/schedule clear`',
        value: 'Remove all your commitments across every slot.',
      },
      {
        name: '`/leave submit`',
        value: 'Submit a leave notice for a session.\n**Format:** `/leave submit date:YYYY-MM-DD slot:(pick from list) reason:(optional)`\n⚠️ Must be submitted **at least 1 hour before** the session. Cannot be edited or withdrawn.',
      },
      {
        name: '`/leave list`',
        value: 'View all your upcoming leave notices.',
      },
      {
        name: '`/warnings`',
        value: 'Check how many absence warnings you have accumulated this month.',
      }
    );

  const rulesEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('📋 Attendance Rules')
    .setDescription(
      '• At the **exact session start time**, the bot checks who is in the study voice channel.\n' +
      '• Not in the channel at that moment = **absent** (no grace period — late counts as absent).\n' +
      '• A valid leave notice = **on leave** (not counted as absent).\n' +
      '• Leave notices are **one-way** — no editing, no withdrawal.\n' +
      '• **5 absences in a calendar month** triggers a public alert in the announcement channel.\n' +
      '• Warning counts **reset automatically** at the start of each month.'
    );

  if (!isAdmin) {
    await interaction.reply({ embeds: [memberEmbed, rulesEmbed], ephemeral: true });
    return;
  }

  const adminEmbed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle('🔧 Admin Commands')
    .addFields(
      {
        name: '`/config voice-channel`',
        value: 'Set the voice channel the bot checks for attendance at session start.',
      },
      {
        name: '`/config announcement-channel`',
        value: 'Set the text channel where absence alerts and session messages are posted.',
      },
      {
        name: '`/slot add time:HH:MM-HH:MM`',
        value: 'Add a new study slot. Example: `/slot add time:06:00-07:00`',
      },
      {
        name: '`/slot remove`',
        value: 'Remove a slot. Select from the dropdown — no ID needed. Affected members are notified.',
      },
      {
        name: '`/slot list`',
        value: 'List all currently active slots.',
      },
      {
        name: '`/admin warnings <user>`',
        value: "View a member's absence warnings for the current month, with per-session details.",
      },
      {
        name: '`/admin attendance-report [month]`',
        value: 'Full attendance summary for all members. Defaults to the current month. Pass `YYYY-MM` for a specific month.',
      }
    )
    .setFooter({ text: 'Admin commands are only visible to members with Administrator permission.' });

  await interaction.reply({ embeds: [adminEmbed, memberEmbed, rulesEmbed], ephemeral: true });
}
