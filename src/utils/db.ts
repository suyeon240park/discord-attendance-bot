import { PrismaClient } from '@prisma/client';

const TIMEZONE = 'America/New_York';

export async function getGuildConfig(prisma: PrismaClient, guildId: string) {
  return prisma.guildConfig.findUnique({ where: { guildId } });
}

export { TIMEZONE };
