import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { resolveAppRoot } from './common/app-root';
import { existsSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const appRoot = resolveAppRoot({
    runtimeDirname: __dirname,
    runtimeCwd: process.cwd(),
    pathExists: existsSync,
  });
  app.useStaticAssets(join(appRoot, 'public'));
  app.setBaseViewsDir(join(appRoot, 'views'));
  app.setViewEngine('hbs');
  await app.listen(3000);
}

bootstrap();
