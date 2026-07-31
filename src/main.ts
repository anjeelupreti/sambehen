import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { validationExceptionFactory } from '@common/validation/validation-exception.factory';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const host = configService.get<string>('app.host', '0.0.0.0');
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const corsOrigin = configService.get<string>('app.corsOrigin', '*');
  const swaggerEnabled = configService.get<boolean>('swagger.enabled', true);

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown properties are rejected rather than stripped, so a typo in
      // a filter name fails loudly instead of silently widening a query.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Produces a structured 422 instead of Nest's default 400 carrying a
      // bare string[] message.
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.enableShutdownHooks();

  if (swaggerEnabled) {
    setupSwagger(app, configService, apiPrefix);
  }

  await app.listen(port, host);

  const logger = app.get(Logger);
  logger.log(`Application running on http://${host}:${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs at http://${host}:${port}/${apiPrefix}/docs`);
  }
}

void bootstrap();
