import { IsString, IsEnum, IsNumber, IsPositive, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsUUID()
  companyId: string;

  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
