import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve absolute path to dev.db so Vercel Serverless Functions can find SQLite database reliably
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('./dev.db')) {
  const possiblePaths = [
    path.resolve(__dirname, '../prisma/dev.db'),
    path.resolve(process.cwd(), 'prisma/dev.db'),
    path.resolve(process.cwd(), 'backend/prisma/dev.db'),
    '/tmp/dev.db'
  ];

  let foundDb = possiblePaths.find(p => fs.existsSync(p));

  if (!foundDb) {
    // Fallback: copy prisma/dev.db to /tmp if writeable environment
    const srcDb = path.resolve(__dirname, '../prisma/dev.db');
    if (fs.existsSync(srcDb)) {
      foundDb = srcDb;
    }
  }

  if (foundDb) {
    process.env.DATABASE_URL = `file:${foundDb}`;
  } else {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, '../prisma/dev.db')}`;
  }
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
