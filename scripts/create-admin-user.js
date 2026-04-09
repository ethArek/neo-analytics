const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const PASSWORD_HASH_LENGTH = 64;

const parseArgs = (argv) => {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
};

const normalizeEmail = (value) => {
  return value.trim().toLowerCase();
};

const hashPassword = (password, salt) => {
  return scryptSync(password, salt, PASSWORD_HASH_LENGTH).toString('hex');
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = normalizeEmail(args.email ?? '');
  const password = args.password ?? '';
  if (!email || !password) {
    console.error(
      'Usage: npm run admin:create -- --email admin@example.com --password "<password>"',
    );
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const prisma = new PrismaClient();

  try {
    await prisma.adminUser.upsert({
      where: { email },
      update: {
        passwordHash,
        passwordSalt: salt,
        sessionToken: null,
        sessionExpiresAt: null,
      },
      create: {
        email,
        passwordHash,
        passwordSalt: salt,
      },
    });

    console.log(`Admin user ready for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to provision admin user: ${message}`);
  process.exitCode = 1;
});
