/**
 * Uygulama açılırken ortam değişkenlerini kontrol eder (ConfigModule `validate`).
 * Eksik/yanlış ayarla sessizce çalışmak yerine hemen, açık bir mesajla durur.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${key} tanımlı değil`);
    }
  }

  // Aynı olurlarsa 7 günlük refresh token, access token yerine de geçer.
  if (errors.length === 0 && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET ile JWT_REFRESH_SECRET farklı olmalı');
  }

  if (errors.length > 0) {
    throw new Error(
      `Ortam değişkeni hatası (.env):\n  - ${errors.join('\n  - ')}`,
    );
  }
  return config;
}
