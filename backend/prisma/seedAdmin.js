import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'utkarsht721@gmail.com';
  const adminPasswordRaw = '9450558546028';
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPasswordRaw, salt);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      isApproved: true,
      name: 'System Admin'
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'System Admin',
      role: 'ADMIN',
      isApproved: true,
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=UtkarshAdmin'
    }
  });

  console.log('✅ Admin user created/updated successfully:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
