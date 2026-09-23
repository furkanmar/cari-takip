import { applyDecorators } from '@nestjs/common';
import { IsDateString, Matches } from 'class-validator';

/**
 * Yalnızca takvim tarihi kabul eder: `YYYY-MM-DD` (ör. 2026-09-23).
 *
 * Neden: `date` kolonları Postgres'te `date` tipinde ve yürüyen bakiye hesabı
 * bu string'leri alfabetik karşılaştırıyor. `@IsDateString()` tek başına
 * `2026-09-23T10:00:00Z` gibi saatli değerleri de kabul ediyordu; bu durumda
 * `'2026-09-23' >= '2026-09-23T10:00:00Z'` false olur ve kayıt hesaplamadan
 * düşerdi. `strict` ayrıca 2026-02-30 gibi var olmayan günleri reddeder.
 */
export function IsDateOnly() {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: '$property YYYY-AA-GG biçiminde olmalı (ör. 2026-09-23)',
    }),
    IsDateString(
      { strict: true },
      { message: '$property geçerli bir tarih değil' },
    ),
  );
}
