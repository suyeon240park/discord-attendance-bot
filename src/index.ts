import { Client, GatewayIntentBits, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { commands } from './commands';
import { startAttendanceJob, checkMissedSessions } from './scheduler/attendanceJob';

const prisma = new PrismaClient();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  await checkMissedSessions(client, prisma);
  startAttendanceJob(client, prisma);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This bot can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction, prisma);
    } catch (err) {
      console.error(`[Command] Error in /${interaction.commandName}:`, err);
      const reply = { content: 'An error occurred while executing this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete || !interaction.inGuild()) return;

    try {
      await command.autocomplete(interaction, prisma);
    } catch (err) {
      console.error(`[Autocomplete] Error in /${interaction.commandName}:`, err);
    }
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const deleted = await prisma.memberCommitment.deleteMany({
      where: { guildId: member.guild.id, userId: member.id },
    });
    if (deleted.count > 0) {
      console.log(`[MemberRemove] Cleaned up ${deleted.count} commitments for ${member.user?.tag ?? member.id}`);
    }
  } catch (err) {
    console.error(`[MemberRemove] Error cleaning up for ${member.id}:`, err);
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

client.login(config.discordToken);
