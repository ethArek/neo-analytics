import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const distPublic = join(__dirname, 'public');
  const rootPublic = join(__dirname, '..', 'public');
  const publicDir = existsSync(distPublic) ? distPublic : rootPublic;

  const distViews = join(__dirname, 'views');
  const rootViews = join(__dirname, '..', 'views');
  const viewsDir = existsSync(distViews) ? distViews : rootViews;

  app.useStaticAssets(publicDir);
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('hbs');
  await app.listen(3000);
}

bootstrap();
