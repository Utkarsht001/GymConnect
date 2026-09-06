import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabaseUrl() {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  
  if (isVercel) {
    const tmpDb = '/tmp/dev.db';
    if (!fs.existsSync(tmpDb)) {
      const candidates = [
        path.resolve(__dirname, '../prisma/dev.db'),
        path.resolve(__dirname, '../../prisma/dev.db'),
        path.resolve(process.cwd(), 'prisma/dev.db'),
        path.resolve(process.cwd(), 'backend/prisma/dev.db')
      ];
      const found = candidates.find(c => fs.existsSync(c));
      if (found) {
        try {
          fs.copyFileSync(found, tmpDb);
          console.log(`Successfully copied SQLite DB from ${found} to ${tmpDb}`);
        } catch (e) {
          console.error('Error copying SQLite DB to /tmp:', e);
        }
      }
    }
    return `file:${tmpDb}`;
  }

  // Local development fallback
  const localCandidates = [
    path.resolve(__dirname, '../prisma/dev.db'),
    path.resolve(process.cwd(), 'prisma/dev.db'),
    path.resolve(process.cwd(), 'backend/prisma/dev.db')
  ];
  const localFound = localCandidates.find(c => fs.existsSync(c)) || localCandidates[0];
  return `file:${localFound}`;
}

const dbUrl = getDatabaseUrl();
process.env.DATABASE_URL = dbUrl;

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
