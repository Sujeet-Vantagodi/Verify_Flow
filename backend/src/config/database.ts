import { Prisma, PrismaClient } from "@prisma/client";

export const database = new PrismaClient();
export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function disconnectDatabase(): Promise<void> {
  await database.$disconnect();
}
