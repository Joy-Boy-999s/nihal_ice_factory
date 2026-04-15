import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { Sale } from './entities/sale.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesRepository } from './repository/sales.repository';
import { GenericTransactionManager } from '../../database/trasanction-manager';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Sale]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CacheModule.register({ isGlobal: true, ttl: 300 }),
  ],
  controllers: [SalesController],
  providers: [SalesService, GenericTransactionManager, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
