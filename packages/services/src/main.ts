import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { createDocument } from './swagger/swagger';
import * as bodyParser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from '@nihal-ice-factory/backend-utils'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ credentials: true, origin: true });

  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

  app.use(bodyParser.urlencoded({ limit: configService.get('maxPayloadSize'), extended: true }));
  app.use(bodyParser.json({ limit: configService.get('maxPayloadSize') }));
  app.useGlobalPipes(new ValidationPipe({ validationError: { target: false }, transform: true, forbidUnknownValues: false }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());

  createDocument(app);

  // Ensure the port is not undefined
  // Pick up Render’s PORT env var first, then your custom one, then fallback
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  

  // Bind to 0.0.0.0 so Render’s router can reach you
  await app.listen(port, '0.0.0.0');

  Logger.log(`🚀 EMS service running on http://0.0.0.0:${port}`);

}

bootstrap();

