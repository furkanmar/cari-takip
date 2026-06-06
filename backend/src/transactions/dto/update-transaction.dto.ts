import { IsString, IsEnum, IsNumber, IsPositive, IsDateString, IsOptional } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class UpdateTransactionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;
}
