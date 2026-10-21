import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Data Wipe: Preserving ONLY Admin Account(s) ---');

  const adminPasswordRaw = process.env.ADMIN_PASSWORD;
  if (!adminPasswordRaw) {
    throw new Error('ADMIN_PASSWORD environment variable is required to run wipe script.');
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPasswordRaw, salt);

  // 1. Ensure Utkarsh Admin exists and has proper credentials
  const utkarshAdmin = await prisma.user.upsert({
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
  console.log('Admin account configured:', utkarshAdmin.email);

  // Also ensure admin@fithub.com exists with the same password so either login works
  const fithubAdmin = await prisma.user.upsert({
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
  console.log('Admin account configured:', fithubAdmin.email);

  const allowedAdminIds = [utkarshAdmin.id, fithubAdmin.id];
  const allowedAdminEmails = [utkarshAdmin.email, fithubAdmin.email];

  // 2. Delete all transactional, relational, and business data
  console.log('Deleting customer & owner activity data...');
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

  // 3. Delete all Gyms (Owner data)
  const deletedGyms = await prisma.gym.deleteMany();
  console.log(`Deleted ${deletedGyms.count} gyms.`);

  // 4. Delete all non-admin users (Customers, Owners, Employees)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        { role: { not: 'ADMIN' } },
        {
          AND: [
            { id: { notIn: allowedAdminIds } },
            { email: { notIn: allowedAdminEmails } }
          ]
        }
      ]
    }
  });
  console.log(`Deleted ${deletedUsers.count} customer and owner accounts.`);

  // 5. Verification
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  });
  const remainingGyms = await prisma.gym.count();
  const remainingSubs = await prisma.subscription.count();
  const remainingProducts = await prisma.product.count();

  console.log('\n--- Wipe Complete! Database Status ---');
  console.log('Remaining Users:');
  console.table(remainingUsers);
  console.log(`Remaining Gyms: ${remainingGyms}`);
  console.log(`Remaining Subscriptions: ${remainingSubs}`);
  console.log(`Remaining Products: ${remainingProducts}`);
}

main()
  .catch((e) => {
    console.error('Error during data wipe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
