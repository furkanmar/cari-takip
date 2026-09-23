import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators';
import { Type } from 'class-transformer';
import { BalanceEntryType } from '../entities/balance-entry.entity';

export class UpdateBalanceEntryDto {
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @IsOptional()
  @IsDateOnly()
  dueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BalanceEntryType)
  type?: BalanceEntryType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;
}
