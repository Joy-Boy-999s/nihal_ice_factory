import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Payment } from './entities/payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './repository/payment.repository';
import { SalesRepository } from '../Sales/repository/sales.repository';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentRepository, SalesRepository],
  exports: [PaymentService],
})
export class PaymentModule {}
