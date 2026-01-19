import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const SESSION_TOKEN_BYTES = 32;
const PASSWORD_HASH_LENGTH = 64;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
}
