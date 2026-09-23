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

export class CreateBalanceEntryDto {
  @IsDateOnly()
  date: string;

  @IsOptional()
  @IsDateOnly()
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
