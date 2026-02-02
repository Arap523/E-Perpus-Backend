const { PrismaClient } = require('@prisma/client');

// Bikin instance Prisma Client
// Kita taruh di sini biar gak perlu new PrismaClient() berkali-kali di setiap controller
const prisma = new PrismaClient();

module.exports = prisma;