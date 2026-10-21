import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanExceptAdmin() {
  console.log('--- Cleaning database: erasing all data except ADMIN ---');

  const adminPasswordRaw = '9450558546028';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPasswordRaw, salt);

  // 1. Ensure Admin accounts exist
  await prisma.user.upsert({
    where: { email: 'utkarsht721@gmail.com' },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      name: 'System Admin (Utkarsh)',
      isApproved: true,
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=UtkarshAdmin'
    },
    create: {
      email: 'utkarsht721@gmail.com',
      password: hashedPassword,
      name: 'System Admin (Utkarsh)',
      role: 'ADMIN',
      isApproved: true,
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=UtkarshAdmin'
    }
  });

  await prisma.user.upsert({
    where: { email: 'admin@fithub.com' },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      name: 'System Admin',
      isApproved: true,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    },
    create: {
      email: 'admin@fithub.com',
      password: hashedPassword,
      name: 'System Admin',
      role: 'ADMIN',
      isApproved: true,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    }
  });

  // 2. Clear all customer and gym owner data
  await prisma.subscriptionPayment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.gymUpdate.deleteMany();
  await prisma.product.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.gymFacility.deleteMany();
  await prisma.gymPhoto.deleteMany();
  await prisma.gym.deleteMany();

  // 3. Delete all non-admin users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: { not: 'ADMIN' }
    }
  });

  console.log(`Deleted non-admin user records: ${deletedUsers.count}`);

  const remaining = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  });
  console.log('\nRemaining Users in Database:');
  console.table(remaining);
}

cleanExceptAdmin()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
