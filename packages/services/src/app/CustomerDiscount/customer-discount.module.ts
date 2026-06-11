import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { CustomerDiscountController } from './customer-discount.controller';
import { CustomerDiscountService } from './customer-discount.service';
import { CustomerDiscountRepository } from './repository/customer-discount.repository';
import { CustomerDiscountTier } from './entities/customer-discount-tier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerDiscountTier]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [CustomerDiscountController],
  providers: [CustomerDiscountService, CustomerDiscountRepository],
  exports: [CustomerDiscountService],
})
export class CustomerDiscountModule {}
