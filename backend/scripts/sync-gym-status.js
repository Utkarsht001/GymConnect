import prisma from '../src/prisma.js';

async function sync() {
  const approved = await prisma.gym.updateMany({
    where: { isApproved: true },
    data: { approvalStatus: 'APPROVED' }
  });
  console.log('Synchronized approved gyms:', approved.count);

  const pending = await prisma.gym.updateMany({
    where: { isApproved: false },
    data: { approvalStatus: 'PENDING' }
  });
  console.log('Synchronized pending gyms:', pending.count);

  const gyms = await prisma.gym.findMany({
    select: { id: true, name: true, isApproved: true, approvalStatus: true }
  });
  console.log('Current gyms in DB:', JSON.stringify(gyms, null, 2));

  await prisma.$disconnect();
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
