import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * API, Cloudflare Tunnel arkasında çalışıyor; tüm istekler cloudflared
 * üzerinden geldiği için req.ip her zaman aynı. Gerçek istemci IP'si
 * Cloudflare'in eklediği CF-Connecting-IP başlığında. Container dışarıya
 * port açmadığı için bu başlık istemci tarafından taklit edilemez.
 */
@Injectable()
export class CfThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cfIp = req.headers?.['cf-connecting-ip'];
    return (Array.isArray(cfIp) ? cfIp[0] : cfIp) ?? req.ip;
  }
}
