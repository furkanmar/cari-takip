/**
 * Kullanıcının yerel saatine göre bugünün tarihi (YYYY-MM-DD).
 * `new Date().toISOString()` UTC verir; Türkiye'de (UTC+3) 00:00–03:00 arası
 * bir önceki günü döndürüyordu.
 */
export function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
