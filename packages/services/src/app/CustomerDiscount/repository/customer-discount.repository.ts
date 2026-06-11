import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerDiscountTier } from '../entities/customer-discount-tier.entity';

@Injectable()
export class CustomerDiscountRepository extends Repository<CustomerDiscountTier> {
  constructor(
    @InjectRepository(CustomerDiscountTier)
    private readonly repo: Repository<CustomerDiscountTier>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  getTiersByCustomer(customerId: string): Promise<CustomerDiscountTier[]> {
    return this.repo.find({ where: { customerId }, order: { minAmount: 'ASC' } });
  }

  async findMatchingTier(customerId: string, amount: number): Promise<CustomerDiscountTier | null> {
    return this.repo
      .createQueryBuilder('tier')
      .where('tier.customerId = :customerId', { customerId })
      .andWhere('tier.minAmount <= :amount', { amount })
      .andWhere('tier.maxAmount > :amount', { amount })
      .getOne();
  }
}
