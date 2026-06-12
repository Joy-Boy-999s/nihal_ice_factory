import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { Sale } from '../Sales/entities/sale.entity';
import { Payment } from '../Payment/entities/payment.entity';
import { UserEntity } from '../user/entities/user.entity';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { PaymentRepository } from '../Payment/repository/payment.repository';
import { IceTypeModule } from '../IcePrice/ice-price.module';
import { PlantModule } from '../Plant/plant.module';
import { CustomerDiscountModule } from '../CustomerDiscount/customer-discount.module';
import { InventoryModule } from '../Inventory/inventory.module';
import { NotificationModule } from '../Notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Sale, Payment, UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    IceTypeModule,
    PlantModule,
    CustomerDiscountModule,
    InventoryModule,
    NotificationModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService, SalesRepository, PaymentRepository],
  exports: [CustomerService],
})
export class CustomerModule {}
