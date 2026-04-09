import { randomBytes, scryptSync } from 'node:crypto';
import type { AdminUser } from '@prisma/client';
import { AdminService } from './admin.service';

const PASSWORD_HASH_LENGTH = 64;

class PrismaStub {
  adminUsers: AdminUser[] = [];

  adminUser = {
    findUnique: async (args: { where: { email: string } }) => {
      return this.adminUsers.find((user) => user.email === args.where.email) ?? null;
    },
    findFirst: async (args: {
      where: {
        sessionToken: string;
        sessionExpiresAt: {
          gt: Date;
        };
      };
    }) => {
      return (
        this.adminUsers.find((user) => {
          if (user.sessionToken !== args.where.sessionToken) {
            return false;
          }

          if (!user.sessionExpiresAt) {
            return false;
          }

          return user.sessionExpiresAt > args.where.sessionExpiresAt.gt;
        }) ?? null
      );
    },
    update: async (args: {
      where: { id: number };
      data: {
        lastLoginAt: Date;
        sessionExpiresAt: Date;
        sessionToken: string;
      };
    }) => {
      const user = this.adminUsers.find((entry) => entry.id === args.where.id);
      if (!user) {
        throw new Error('Missing admin user');
      }

      user.sessionToken = args.data.sessionToken;
      user.sessionExpiresAt = args.data.sessionExpiresAt;
      user.lastLoginAt = args.data.lastLoginAt;

      return user;
    },
    updateMany: async (args: {
      where: { sessionToken: string };
      data: {
        sessionExpiresAt: null;
        sessionToken: null;
      };
    }) => {
      let count = 0;
      for (const user of this.adminUsers) {
        if (user.sessionToken !== args.where.sessionToken) {
          continue;
        }

        user.sessionToken = args.data.sessionToken;
        user.sessionExpiresAt = args.data.sessionExpiresAt;
        count += 1;
      }

      return { count };
    },
  };
}

const createPasswordHash = (password: string, salt: string): string => {
  return scryptSync(password, salt, PASSWORD_HASH_LENGTH).toString('hex');
};

const createAdminUser = (overrides: Partial<AdminUser> = {}): AdminUser => {
  const salt = overrides.passwordSalt ?? randomBytes(16).toString('hex');
  const password = 'correct horse battery staple';

  return {
    id: overrides.id ?? 1,
    email: overrides.email ?? 'admin@example.com',
    passwordHash: overrides.passwordHash ?? createPasswordHash(password, salt),
    passwordSalt: salt,
    sessionToken: overrides.sessionToken ?? null,
    sessionExpiresAt: overrides.sessionExpiresAt ?? null,
    lastLoginAt: overrides.lastLoginAt ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-03-01T00:00:00.000Z'),
  };
};

describe('AdminService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('expires sessions on the server side when looking up an admin session', async () => {
    const prisma = new PrismaStub();
    prisma.adminUsers.push(
      createAdminUser({
        sessionToken: 'expired-token',
        sessionExpiresAt: new Date(Date.now() - 60_000),
      }),
    );
    const service = Reflect.construct(AdminService, [prisma]) as AdminService;

    const admin = await service.findAdminBySession('expired-token');

    expect(admin).toBeNull();
  });

  it('blocks login attempts after repeated failures from the same client', async () => {
    const prisma = new PrismaStub();
    prisma.adminUsers.push(createAdminUser());
    const service = Reflect.construct(AdminService, [prisma]) as AdminService;

    for (let index = 0; index < 5; index += 1) {
      const result = await service.authenticateAdmin(
        'admin@example.com',
        `wrong-password-${index}`,
        '127.0.0.1',
      );

      expect(result).toEqual({ status: 'invalid' });
    }

    const blocked = await service.authenticateAdmin(
      'admin@example.com',
      'correct horse battery staple',
      '127.0.0.1',
    );

    expect(blocked.status).toBe('blocked');
  });

  it('creates an expiring session after a successful login', async () => {
    const prisma = new PrismaStub();
    prisma.adminUsers.push(createAdminUser());
    const service = Reflect.construct(AdminService, [prisma]) as AdminService;

    const authentication = await service.authenticateAdmin(
      'admin@example.com',
      'correct horse battery staple',
      '127.0.0.1',
    );

    expect(authentication.status).toBe('success');
    if (authentication.status !== 'success') {
      return;
    }

    const token = await service.createSession(authentication.admin.id);
    const stored = prisma.adminUsers[0];

    expect(token).toHaveLength(64);
    expect(stored?.sessionToken).toBe(token);
    expect(stored?.sessionExpiresAt).toBeInstanceOf(Date);
    expect((stored?.sessionExpiresAt?.getTime() ?? 0) > Date.now()).toBe(true);
  });
});
