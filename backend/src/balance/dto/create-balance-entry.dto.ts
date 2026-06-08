import { IsString, IsEnum, IsNumber, IsPositive, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { BalanceEntryType } from '../entities/balance-entry.entity';

export class CreateBalanceEntryDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsString()
  description: string;

  @IsEnum(BalanceEntryType)
  type: BalanceEntryType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
