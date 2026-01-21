import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import hbs from 'hbs';
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
  const partialsDir = join(viewsDir, 'partials');
  if (existsSync(partialsDir)) {
    hbs.registerPartials(partialsDir);
  }

  app.useStaticAssets(publicDir);
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('hbs');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Neo Analytics API')
    .setDescription('Public stats endpoints for Neo N3 analytics.')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(3000);
}

bootstrap();
