import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanExceptAdmin() {
  console.log('Cleaning database: erasing all users and user data except ADMIN...');

  // 1. Find or verify Admin user
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.log('No Admin found! Creating default Admin account...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('9450558546028', salt);
    admin = await prisma.user.create({
      data: {
        email: 'admin@fithub.com',
        password: hashedPassword,
        name: 'System Admin',
        role: 'ADMIN',
        isApproved: true,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      }
    });
    console.log('Admin account created: admin@fithub.com / 9450558546028');
  } else {
    console.log(`Found existing Admin account: ${admin.email} (ID: ${admin.id})`);
  }

  // 2. Fetch all non-admin user IDs
  const nonAdminUsers = await prisma.user.findMany({
    where: {
      id: { not: admin.id },
      role: { not: 'ADMIN' }
    },
    select: { id: true, email: true, role: true }
  });

  const nonAdminIds = nonAdminUsers.map(u => u.id);
  console.log(`Found ${nonAdminIds.length} non-admin users to delete:`, nonAdminUsers.map(u => `${u.email} (${u.role})`));

  if (nonAdminIds.length > 0) {
    // Delete dependent tables first or rely on cascade
    await prisma.notification.deleteMany({ where: { userId: { in: nonAdminIds } } });
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: nonAdminIds } },
          { receiverId: { in: nonAdminIds } }
        ]
      }
    });
    await prisma.review.deleteMany({ where: { customerId: { in: nonAdminIds } } });
    await prisma.favorite.deleteMany({ where: { customerId: { in: nonAdminIds } } });
    await prisma.orderItem.deleteMany({ where: { order: { customerId: { in: nonAdminIds } } } });
    await prisma.order.deleteMany({ where: { customerId: { in: nonAdminIds } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: nonAdminIds } } } });
    await prisma.cart.deleteMany({ where: { userId: { in: nonAdminIds } } });
    await prisma.subscription.deleteMany({ where: { customerId: { in: nonAdminIds } } });
    await prisma.complaint.deleteMany({ where: { customerId: { in: nonAdminIds } } });

    // Gyms belonging to deleted owners
    const ownerGyms = await prisma.gym.findMany({
      where: { ownerId: { in: nonAdminIds } },
      select: { id: true }
    });
    const gymIds = ownerGyms.map(g => g.id);

    if (gymIds.length > 0) {
      await prisma.gymPhoto.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.gymFacility.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.membershipPlan.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.gymUpdate.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.product.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.subscriptionPayment.deleteMany({ where: { gymId: { in: gymIds } } });
      await prisma.gym.deleteMany({ where: { id: { in: gymIds } } });
    }

    // Delete non-admin users
    const deleteResult = await prisma.user.deleteMany({
      where: { id: { in: nonAdminIds } }
    });
    console.log(`Successfully deleted ${deleteResult.count} non-admin user records!`);
  } else {
    console.log('No non-admin users found to delete.');
  }

  // Print remaining users
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
