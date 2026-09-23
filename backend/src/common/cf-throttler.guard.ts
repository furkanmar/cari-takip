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
  protected getTracker(req: Record<string, any>): Promise<string> {
    const headers = req.headers as
      | Record<string, string | string[] | undefined>
      | undefined;
    const cfIp = headers?.['cf-connecting-ip'];
    const ip = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    return Promise.resolve(ip ?? (req.ip as string));
  }
}
