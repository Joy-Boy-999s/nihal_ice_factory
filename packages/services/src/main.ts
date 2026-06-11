import { ClassSerializerInterceptor, Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { createDocument } from './swagger/swagger';
import * as bodyParser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter, LoggingInterceptor } from '@nihal-ice-factory/backend-utils'

const isProd = process.env.NODE_ENV === 'production';

/* LOG_LEVEL env var (comma-separated) overrides the defaults, e.g. LOG_LEVEL=debug,log,warn,error */
const logLevels: LogLevel[] =
  (process.env.LOG_LEVEL?.split(',').map((l) => l.trim()) as LogLevel[] | undefined) ??
  (isProd ? ['log', 'warn', 'error'] : ['debug', 'verbose', 'log', 'warn', 'error']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: logLevels });
  app.enableCors({ credentials: true, origin: true });

  // Render runs behind a proxy — needed for correct req.ip in logs
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

  app.use(bodyParser.urlencoded({ limit: configService.get('maxPayloadSize'), extended: true }));
  app.use(bodyParser.json({
    limit: configService.get('maxPayloadSize'),
    // Keep the raw bytes — Razorpay webhook signatures are computed over them
    verify: (req: { rawBody?: Buffer }, _res, buf) => { req.rawBody = buf; },
  }));
  app.useGlobalPipes(new ValidationPipe({ validationError: { target: false }, transform: true, forbidUnknownValues: false }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector), new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  createDocument(app);

  // Ensure the port is not undefined
  // Pick up Render’s PORT env var first, then your custom one, then fallback
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

  Logger.log(`🚀 EMS service running on http://0.0.0.0:${port} (env=${process.env.NODE_ENV ?? 'development'}, logLevels=${logLevels.join(',')})`);
}

/* Last-resort logging — these otherwise crash silently or with a bare stack */
process.on('unhandledRejection', (reason) => {
  Logger.error(
    `Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
    'Process',
  );
});

process.on('uncaughtException', (err) => {
  Logger.error(`Uncaught exception: ${err.stack ?? err.message}`, 'Process');
});

bootstrap();
