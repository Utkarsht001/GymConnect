import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.gym.updateMany({
    data: { isApproved: true }
  });
  console.log('Approved all gyms count:', result.count);
}
main().finally(() => prisma.$disconnect());
