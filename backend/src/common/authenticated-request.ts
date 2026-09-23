import type { Request } from 'express';
import type { User } from '../users/entities/user.entity';

/**
 * JwtAuthGuard'dan geçmiş istek: JwtStrategy.validate() kullanıcıyı
 * veritabanından yükleyip req.user'a koyar. Controller'larda `@Request() req`
 * yerine bu tip kullanılır; böylece `req.user.id` tip güvenli olur.
 *
 * Not: decorator'lı parametrede kullanıldığı için `import type` ile alınmalı
 * (isolatedModules + emitDecoratorMetadata).
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}
