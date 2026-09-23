// Genel sınır: IP başına dakikada 120 istek. Auth uçları daha sıkı (bkz. AuthController).
// Ayrı dosyada, çünkü e2e testleri de kullanıyor: app.module.ts'i import etmek
// ConfigModule.forRoot'u (ve env doğrulamasını) test env'i hazırlanmadan çalıştırırdı.
export const THROTTLE_DEFAULT = [{ ttl: 60_000, limit: 120 }];
