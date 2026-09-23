import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * main.ts ve e2e testlerinin paylaştığı uygulama ayarları. Testler gerçek
 * uygulamayla aynı prefix ve doğrulama kurallarıyla çalışsın diye tek yerde.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
