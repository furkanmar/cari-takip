import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators';
import { Type } from 'class-transformer';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsUUID()
  companyId: string;

  @IsDateOnly()
  date: string;

  @IsOptional()
  @IsDateOnly()
  dueDate?: string;

  @IsString()
  description: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
