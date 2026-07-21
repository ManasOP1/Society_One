import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { json, raw, Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/rbac.guards';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Preserve raw body for Razorpay webhook signature verification
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl?.includes('/webhooks/razorpay')) {
      return raw({ type: '*/*' })(req, res, (err) => {
        if (err) return next(err);
        (req as Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
        next();
      });
    }
    return json({ limit: '2mb' })(req, res, next);
  });

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Zod DTOs (createZodDto) carry no class-validator metadata, so a class-validator
  // ValidationPipe with whitelist:true would strip every property. Zod alone validates/transforms.
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  const swagger = new DocumentBuilder()
    .setTitle('SocietyOne API')
    .setDescription(
      'Production multi-tenant society management API. Razorpay online payments are optional (RAZORPAY_ENABLED).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SocietyOne API listening on :${port}  docs=/docs  prefix=/${prefix}`);
}

bootstrap();
