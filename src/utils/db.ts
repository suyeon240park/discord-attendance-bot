import { PrismaClient } from '@prisma/client';

export async function getGuildConfig(prisma: PrismaClient, guildId: string) {
  return prisma.guildConfig.findUnique({ where: { guildId } });
}

export async function getGuildTimezone(prisma: PrismaClient, guildId: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  return config?.timezone ?? 'America/New_York';
}

export async function getUserTimezone(
  prisma: PrismaClient,
  userId: string,
  fallbackTz: string
): Promise<string> {
  const pref = await prisma.userPreference.findUnique({ where: { userId } });
  return pref?.timezone ?? fallbackTz;
}
