import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export function requireAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    interaction.reply({ content: 'This command requires Administrator permission.', ephemeral: true });
    return false;
  }
  return true;
}
