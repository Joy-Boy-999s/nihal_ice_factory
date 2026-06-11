import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { IceBatchRepository } from './repository/ice-batch.repository';
import { IceSlotRepository } from './repository/ice-slot.repository';
import { IceBatch } from './entities/ice-batch.entity';
import { IceSlot } from './entities/ice-slot.entity';
import { IceTypeModule } from '../IcePrice/ice-price.module';
import { PlantModule } from '../Plant/plant.module';
import { SalesModule } from '../Sales/sales.module';
import { GenericTransactionManager } from '../../database/trasanction-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([IceBatch, IceSlot]),
    IceTypeModule,
    PlantModule,
    SalesModule,
  ],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    IceBatchRepository,
    IceSlotRepository,
    GenericTransactionManager,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
