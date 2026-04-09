import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  LOGIN_RATE_LIMIT_BLOCK_MS,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  SESSION_MAX_AGE,
} from './admin.constants';

const SESSION_TOKEN_BYTES = 32;
const PASSWORD_HASH_LENGTH = 64;

type LoginAttemptState = {
  attemptCount: number;
  blockedUntil?: number;
  windowStartedAt: number;
};

export type AdminAuthenticationResult =
  | {
      status: 'success';
      admin: AdminUser;
    }
  | {
      status: 'invalid';
    }
  | {
      retryAfterSeconds: number;
      status: 'blocked';
    };

@Injectable()
export class AdminService {
  private readonly loginAttempts = new Map<string, LoginAttemptState>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async authenticateAdmin(
    email: string,
    password: string,
    ipAddress = 'unknown',
  ): Promise<AdminAuthenticationResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const loginKey = this.buildLoginKey(normalizedEmail, ipAddress);
    const now = Date.now();
    const blockedUntil = this.getBlockedUntil(loginKey, now);
    if (blockedUntil !== null) {
      return {
        status: 'blocked',
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      };
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    if (!admin) {
      this.recordFailedLogin(loginKey, now);
      return { status: 'invalid' };
    }

    const isValid = this.verifyPassword(password, admin.passwordSalt, admin.passwordHash);
    if (!isValid) {
      this.recordFailedLogin(loginKey, now);
      return { status: 'invalid' };
    }

    this.loginAttempts.delete(loginKey);

    return {
      status: 'success',
      admin,
    };
  }

  async createSession(adminId: number): Promise<string> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_AGE);
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        sessionToken: token,
        sessionExpiresAt,
        lastLoginAt: new Date(),
      },
    });

    return token;
  }

  async clearSession(token: string): Promise<void> {
    await this.prisma.adminUser.updateMany({
      where: { sessionToken: token },
      data: {
        sessionToken: null,
        sessionExpiresAt: null,
      },
    });
  }

  async findAdminBySession(token: string) {
    return this.prisma.adminUser.findFirst({
      where: {
        sessionToken: token,
        sessionExpiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, PASSWORD_HASH_LENGTH).toString('hex');
  }

  private verifyPassword(password: string, salt: string, expectedHash: string): boolean {
    const hash = this.hashPassword(password, salt);
    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (hashBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashBuffer, expectedBuffer);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private buildLoginKey(email: string, ipAddress: string): string {
    return `${email}|${ipAddress.trim() || 'unknown'}`;
  }

  private getBlockedUntil(loginKey: string, now: number): number | null {
    const state = this.loginAttempts.get(loginKey);
    if (!state) {
      return null;
    }

    if (state.blockedUntil && state.blockedUntil > now) {
      return state.blockedUntil;
    }

    if (now - state.windowStartedAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      this.loginAttempts.delete(loginKey);
      return null;
    }

    if (state.blockedUntil && state.blockedUntil <= now) {
      this.loginAttempts.delete(loginKey);
    }

    return null;
  }

  private recordFailedLogin(loginKey: string, now: number): void {
    const existing = this.loginAttempts.get(loginKey);
    if (!existing || now - existing.windowStartedAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      this.loginAttempts.set(loginKey, {
        attemptCount: 1,
        windowStartedAt: now,
      });
      return;
    }

    const attemptCount = existing.attemptCount + 1;
    const nextState: LoginAttemptState = {
      attemptCount,
      windowStartedAt: existing.windowStartedAt,
    };
    if (attemptCount >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      nextState.blockedUntil = now + LOGIN_RATE_LIMIT_BLOCK_MS;
    }

    this.loginAttempts.set(loginKey, nextState);
  }
}
