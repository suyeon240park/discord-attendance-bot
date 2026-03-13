import { REST, Routes } from 'discord.js';
import { config } from './config';
import { getCommandJsonData } from './commands';

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commandData = getCommandJsonData();

  console.log(`Deploying ${commandData.length} commands...`);

  await rest.put(
    Routes.applicationCommands(config.clientId),
    { body: commandData }
  );

  console.log('Commands deployed successfully.');
}

deployCommands().catch(console.error);
