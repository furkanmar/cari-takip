import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsUUID()
  companyId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsString()
  description: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
