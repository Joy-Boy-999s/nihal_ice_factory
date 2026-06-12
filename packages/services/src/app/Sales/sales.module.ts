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
import { IceTypeModule } from '../IcePrice/ice-price.module';
import { PlantModule } from '../Plant/plant.module';
import { IceBatch } from '../Inventory/entities/ice-batch.entity';
import { IceSlot } from '../Inventory/entities/ice-slot.entity';
import { IceBatchRepository } from '../Inventory/repository/ice-batch.repository';
import { IceSlotRepository } from '../Inventory/repository/ice-slot.repository';
import { Payment } from '../Payment/entities/payment.entity';

import { AuditModule } from '../Audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Sale, IceBatch, IceSlot, Payment]),
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
    IceTypeModule,
    PlantModule,
    AuditModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, GenericTransactionManager, SalesRepository, IceBatchRepository, IceSlotRepository],
  exports: [SalesService, SalesRepository],
})
export class SalesModule {}
