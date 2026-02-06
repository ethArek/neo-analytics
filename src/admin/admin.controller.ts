import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';
import { renderReactPage } from '../web/react-view';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@ApiExcludeController()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Get()
  async adminHome(@Req() req: Request, @Res() res: Response) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    return res.send(
      renderReactPage({
        title: 'Admin console · Neo Analytics',
        page: 'admin',
        data: {
          email: admin.email,
          defaultDate: yesterdayInTimeZone('Europe/Warsaw'),
        },
      }),
    );
  }

  @Get('login')
  async loginForm(@Res() res: Response) {
    return res.send(
      renderReactPage({
        title: 'Admin login · Neo Analytics',
        page: 'admin-login',
        data: {},
      }),
    );
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const email = body.email ?? '';
    const password = body.password ?? '';
    const admin = await this.adminService.authenticateAdmin(email, password);
    if (!admin) {
      res.status(401);
      return res.send(
        renderReactPage({
          title: 'Admin login · Neo Analytics',
          page: 'admin-login',
          data: {
            error: 'Invalid email or password.',
            email,
          },
        }),
      );
    }

    const token = await this.adminService.createSession(admin.id);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      secure: this.shouldUseSecureCookies(req),
    });

    return res.redirect('/admin');
  }

  @Post('ingest')
  async ingest(
    @Req() req: Request,
    @Res() res: Response,
    @Body('date') date?: string,
  ) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    const targetDate = (date ?? '').trim() || yesterdayInTimeZone('Europe/Warsaw');
    if (!this.isValidDate(targetDate)) {
      res.status(400);
      return res.send(
        renderReactPage({
          title: 'Admin console · Neo Analytics',
          page: 'admin',
          data: {
            email: admin.email,
            defaultDate: targetDate,
            error: 'Enter a valid date in YYYY-MM-DD format.',
          },
        }),
      );
    }

    try {
      await this.ingestionService.ingestDay(targetDate);
      return res.send(
        renderReactPage({
          title: 'Admin console · Neo Analytics',
          page: 'admin',
          data: {
            email: admin.email,
            defaultDate: targetDate,
            message: `Ingestion completed for ${targetDate}.`,
          },
        }),
      );
    } catch (error) {
      res.status(500);
      return res.send(
        renderReactPage({
          title: 'Admin console · Neo Analytics',
          page: 'admin',
          data: {
            email: admin.email,
            defaultDate: targetDate,
            error: 'Ingestion failed. Check logs for details.',
          },
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
    res.clearCookie(SESSION_COOKIE);
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
      res.clearCookie(SESSION_COOKIE);
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
}
