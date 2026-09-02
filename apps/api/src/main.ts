import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Everything is served under /api so nginx can route by prefix alone —
  // one location block forwards /api/* here, everything else goes to Next.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // In production the browser only ever talks to the same origin (nginx
  // proxies /api), so CORS matters solely for `pnpm dev`.
  // CORS_ORIGIN pins the allowed origins wherever that matters. Unset, this is a
  // developer machine, where the dev server's port is whatever was free — so any
  // loopback origin is allowed rather than one hardcoded port that goes stale.
  const configured = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
  app.enableCors({ origin: configured ?? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ });

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port, '127.0.0.1');
  new Logger('Bootstrap').log(`API listening on http://127.0.0.1:${port}/api`);
}

void bootstrap();
