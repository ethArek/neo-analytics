import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { formatDate, parseDate, yesterdayInTimeZone } from '../ingestion/date-utils';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

type AdminRequest = {
  headers: { cookie?: string; 'x-forwarded-proto'?: string };
  secure?: boolean;
};

type AdminResponse = {
  cookie: (
    name: string,
    value: string,
    options: { httpOnly: boolean; sameSite: 'lax'; maxAge: number; secure: boolean },
  ) => void;
  clearCookie: (name: string) => void;
  redirect: (path: string) => void;
  render: (view: string, locals?: Record<string, unknown>) => void;
  status: (code: number) => AdminResponse;
};

@ApiExcludeController()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Get()
  async adminHome(@Req() req: AdminRequest, @Res() res: AdminResponse) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    return res.render('admin', {
      email: admin.email,
      defaultDate: yesterdayInTimeZone('Europe/Warsaw'),
    });
  }

  @Get('login')
  async loginForm(@Res() res: AdminResponse) {
    return res.render('admin-login');
  }

  @Post('login')
  async login(
    @Req() req: AdminRequest,
    @Body() body: Record<string, string>,
    @Res() res: AdminResponse,
  ) {
    const email = body.email ?? '';
    const password = body.password ?? '';
    const admin = await this.adminService.authenticateAdmin(email, password);
    if (!admin) {
      res.status(401);
      return res.render('admin-login', {
        error: 'Invalid email or password.',
        email,
      });
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
    @Req() req: AdminRequest,
    @Res() res: AdminResponse,
    @Body('date') date?: string,
  ) {
    const admin = await this.requireAdmin(req, res);
    if (!admin) {
      return;
    }

    const targetDate = (date ?? '').trim() || yesterdayInTimeZone('Europe/Warsaw');
    if (!this.isValidDate(targetDate)) {
      res.status(400);
      return res.render('admin', {
        email: admin.email,
        defaultDate: targetDate,
        error: 'Enter a valid date in YYYY-MM-DD format.',
      });
    }

    try {
      await this.ingestionService.ingestDay(targetDate);
      return res.render('admin', {
        email: admin.email,
        defaultDate: targetDate,
        message: `Ingestion completed for ${targetDate}.`,
      });
    } catch (error) {
      res.status(500);
      return res.render('admin', {
        email: admin.email,
        defaultDate: targetDate,
        error: 'Ingestion failed. Check logs for details.',
      });
    }
  }

  @Post('logout')
  async logout(@Req() req: AdminRequest, @Res() res: AdminResponse) {
    const token = this.getSessionToken(req);
    if (token) {
      await this.adminService.clearSession(token);
    }
    res.clearCookie(SESSION_COOKIE);
    return res.redirect('/admin/login');
  }

  private async requireAdmin(req: AdminRequest, res: AdminResponse) {
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

  private getSessionToken(req: AdminRequest): string | null {
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

  private shouldUseSecureCookies(req: AdminRequest): boolean {
    if (req.secure) {
      return true;
    }

    const forwarded = req.headers['x-forwarded-proto'];
    if (!forwarded) {
      return false;
    }

    return forwarded.split(',')[0].trim().toLowerCase() === 'https';
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
