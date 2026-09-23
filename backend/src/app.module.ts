import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CfThrottlerGuard } from './common/cf-throttler.guard';
import { validateEnv } from './config/env.validation';
import { THROTTLE_DEFAULT } from './common/throttle.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BalanceModule } from './balance/balance.module';
import { FilesModule } from './files/files.module';
import { User } from './users/entities/user.entity';
import { Company } from './companies/entities/company.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { BalanceEntry } from './balance/entities/balance-entry.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot(THROTTLE_DEFAULT),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [User, Company, Transaction, BalanceEntry],
        synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
        logging: configService.get('DB_LOGGING') === 'true',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CompaniesModule,
    TransactionsModule,
    BalanceModule,
    FilesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CfThrottlerGuard }],
})
export class AppModule {}
