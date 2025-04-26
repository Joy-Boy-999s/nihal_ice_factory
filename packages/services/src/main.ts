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
  const port = configService.get('port') || 3000; // Default to 3000 if undefined
  const server = await app.listen(port);
  server.setTimeout(1000 * configService.get('responseTimeOut'));

  Logger.log('APP ENV :', configService.get('env'));
  Logger.log(`🚀 EMS service - http://localhost:${port}`);
}

bootstrap();

