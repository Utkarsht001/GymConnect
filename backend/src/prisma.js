import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

function getDatabaseUrl() {
  let url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('[Prisma Fatal] DATABASE_URL (or NEON_DATABASE_URL) environment variable is not defined.');
  }
  // Optimize connection pooling for serverless Neon PostgreSQL
  if (url.includes('pooler') && !url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connection_limit=5&pool_timeout=10`;
  }
  return url;
}

const dbUrl = getDatabaseUrl();
process.env.DATABASE_URL = dbUrl;

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

// Preserve PrismaClient instance across warm serverless Lambda invocations
globalForPrisma.prisma = prisma;

export default prisma;
