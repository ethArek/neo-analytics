import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';
import { IngestionBusyError, IngestionService } from '../ingestion/ingestion.service';
import { renderReactPage } from '../web/react-view';
import { TokenPerformanceService } from '../web/token-performance.service';
import { SESSION_COOKIE, SESSION_COOKIE_PATH, SESSION_MAX_AGE } from './admin.constants';
import { AdminService } from './admin.service';

@ApiExcludeController()
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
    @Inject(IngestionService) private readonly ingestionService: IngestionService,
    @Inject(TokenPerformanceService)
    private readonly tokenPerformanceService: TokenPerformanceService,
  ) {}

  @Get()
  async adminHome(@Req() req: Request, @Res() res: Response) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    return res.send(
      await this.renderAdminPage({
        email: admin.email,
        defaultDate: yesterdayInTimeZone('Europe/Warsaw'),
      }),
    );
  }

  @Get('login')
  async loginForm(@Res() res: Response) {
    return res.send(await this.renderAdminLoginPage({}));
  }

  @Post('login')
  async login(@Req() req: Request, @Body() body: Record<string, string>, @Res() res: Response) {
    const email = body.email ?? '';
    const password = body.password ?? '';
    const authentication = await this.adminService.authenticateAdmin(
      email,
      password,
      this.getClientIp(req),
    );
    if (authentication.status === 'blocked') {
      res.status(429);
      return res.send(
        await this.renderAdminLoginPage({
          error: `Too many failed sign-in attempts. Try again in ${Math.ceil(
            authentication.retryAfterSeconds / 60,
          )} minute(s).`,
          email,
        }),
      );
    }

    if (authentication.status !== 'success') {
      res.status(401);
      return res.send(
        await this.renderAdminLoginPage({
          error: 'Invalid email or password.',
          email,
        }),
      );
    }

    const token = await this.adminService.createSession(authentication.admin.id);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      path: SESSION_COOKIE_PATH,
      sameSite: 'strict',
      secure: this.shouldUseSecureCookies(req),
    });

    return res.redirect('/admin');
  }

  @Post('ingest')
  async ingest(@Req() req: Request, @Res() res: Response, @Body('date') date?: string) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    const targetDate = (date ?? '').trim() || yesterdayInTimeZone('Europe/Warsaw');
    if (!this.isValidDate(targetDate)) {
      res.status(400);
      return res.send(
        await this.renderAdminPage({
          email: admin.email,
          defaultDate: targetDate,
          error: 'Enter a valid date in YYYY-MM-DD format.',
        }),
      );
    }

    try {
      await this.ingestionService.ingestDay(targetDate);
      return res.send(
        await this.renderAdminPage({
          email: admin.email,
          defaultDate: targetDate,
          message: `Ingestion completed for ${targetDate}.`,
        }),
      );
    } catch (error) {
      if (error instanceof IngestionBusyError) {
        res.status(409);
        return res.send(
          await this.renderAdminPage({
            email: admin.email,
            defaultDate: targetDate,
            error: error.message,
          }),
        );
      }

      res.status(500);
      return res.send(
        await this.renderAdminPage({
          email: admin.email,
          defaultDate: targetDate,
          error: 'Ingestion failed. Check logs for details.',
        }),
      );
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = this.getSessionToken(req);
    if (token) {
      await this.adminService.clearSession(token);
    }
    this.clearSessionCookie(req, res);
    return res.redirect('/admin/login');
  }

  private async requireAdmin(req: Request, res: Response) {
    const token = this.getSessionToken(req);
    if (!token) {
      res.redirect('/admin/login');
      return null;
    }

    const admin = await this.adminService.findAdminBySession(token);
    if (!admin) {
      this.clearSessionCookie(req, res);
      res.redirect('/admin/login');
      return null;
    }

    return admin;
  }

  private getSessionToken(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((entry: string) => entry.trim());
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.split('=');
      if (name === SESSION_COOKIE) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return null;
  }

  private shouldUseSecureCookies(req: Request): boolean {
    if (req.secure) {
      return true;
    }

    const forwarded = req.headers['x-forwarded-proto'];
    if (!forwarded) {
      return false;
    }

    const protoHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const proto = protoHeader.split(',')[0].trim().toLowerCase();

    return proto === 'https';
  }

  private clearSessionCookie(req: Request, res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
      path: SESSION_COOKIE_PATH,
      sameSite: 'strict',
      secure: this.shouldUseSecureCookies(req),
    });
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = parseDate(value);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    return formatDate(parsed, 'UTC') === value;
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      const candidate = forwardedFor.split(',')[0]?.trim();
      if (candidate) {
        return candidate;
      }
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
      return forwardedFor[0];
    }

    return req.ip ?? 'unknown';
  }

  private async renderAdminPage(data: {
    email?: string;
    defaultDate?: string;
    message?: string;
    error?: string;
  }) {
    const marketPrices = await this.tokenPerformanceService.getMarketPrices();

    return renderReactPage({
      title: 'Admin console · Neo Analytics',
      page: 'admin',
      data: {
        ...data,
        marketPrices,
      },
    });
  }

  private async renderAdminLoginPage(data: { email?: string; error?: string }) {
    const marketPrices = await this.tokenPerformanceService.getMarketPrices();

    return renderReactPage({
      title: 'Admin login · Neo Analytics',
      page: 'admin-login',
      data: {
        ...data,
        marketPrices,
      },
    });
  }
}
