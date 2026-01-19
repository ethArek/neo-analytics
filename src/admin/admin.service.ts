import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const PASSWORD_SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;
const PASSWORD_HASH_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

type RegisterResult = { ok: true; adminId: number } | { ok: false; error: string };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async hasAdmins(): Promise<boolean> {
    const count = await this.prisma.adminUser.count();
    return count > 0;
  }

  async registerAdmin(email: string, password: string): Promise<RegisterResult> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!this.isValidEmail(normalizedEmail)) {
      return { ok: false, error: 'Enter a valid email address.' };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }

    const existing = await this.prisma.adminUser.count();
    if (existing > 0) {
      return { ok: false, error: 'Registration is disabled once an admin exists.' };
    }

    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const hash = this.hashPassword(password, salt);
    const admin = await this.prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });

    return { ok: true, adminId: admin.id };
  }

  async authenticateAdmin(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    if (!admin) {
      return null;
    }

    const isValid = this.verifyPassword(password, admin.passwordSalt, admin.passwordHash);
    if (!isValid) {
      return null;
    }

    return admin;
  }

  async createSession(adminId: number): Promise<string> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        sessionToken: token,
        lastLoginAt: new Date(),
      },
    });

    return token;
  }

  async clearSession(token: string): Promise<void> {
    await this.prisma.adminUser.updateMany({
      where: { sessionToken: token },
      data: { sessionToken: null },
    });
  }

  async findAdminBySession(token: string) {
    return this.prisma.adminUser.findFirst({ where: { sessionToken: token } });
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

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
