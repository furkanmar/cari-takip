import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { CompaniesModule } from '../companies/companies.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CompaniesModule,
    FilesModule,
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
