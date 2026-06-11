import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Payment } from './entities/payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './repository/payment.repository';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { InventoryModule } from '../Inventory/inventory.module';
import { NotificationModule } from '../Notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    InventoryModule,
    NotificationModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, PaymentRepository, SalesRepository],
  exports: [PaymentService],
})
export class PaymentModule {}
