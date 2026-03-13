import { Collection, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';

import * as configCmd from './config';
import * as slotCmd from './slot';
import * as scheduleCmd from './schedule';
import * as leaveCmd from './leave';
import * as adminCmd from './admin';
import * as warningsCmd from './warnings';
import * as helpCmd from './help';

interface Command {
  data: { name: string; toJSON(): unknown };
  execute: (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction, prisma: PrismaClient) => Promise<void>;
}

const commandList: Command[] = [configCmd, slotCmd, scheduleCmd, leaveCmd, adminCmd, warningsCmd, helpCmd];

export const commands = new Collection<string, Command>();
for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}

export function getCommandJsonData() {
  return commandList.map((c) => c.data.toJSON());
}
