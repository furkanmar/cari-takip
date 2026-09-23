import { isAxiosError } from "axios";

/**
 * API hatasından kullanıcıya gösterilecek mesajı çıkarır.
 * Nest'in ValidationPipe'ı `message` alanını dizi olarak döndürebilir; onu birleştirir.
 */
export function apiErrorMessage(err: unknown, fallback = "Hata oluştu."): string {
  if (isAxiosError<{ message?: string | string[] }>(err)) {
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (msg) return msg;
  }
  return fallback;
}
