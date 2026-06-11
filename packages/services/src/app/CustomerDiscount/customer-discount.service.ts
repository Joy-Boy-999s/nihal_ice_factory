import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CustomerDiscountRepository } from './repository/customer-discount.repository';
import { CreateDiscountTierDto, UpdateDiscountTierDto } from './dto/create-discount-tier.dto';

@Injectable()
export class CustomerDiscountService {
  constructor(private readonly discountRepo: CustomerDiscountRepository) {}

  async getTiers(customerId: string): Promise<CommonResponse> {
    try {
      const tiers = await this.discountRepo.getTiersByCustomer(customerId);
      return new CommonResponse(true, 200, 'Discount tiers fetched', tiers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tiers';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async createTier(dto: CreateDiscountTierDto): Promise<CommonResponse> {
    try {
      const tier = this.discountRepo.create({
        customerId:      dto.customerId,
        minAmount:       dto.minAmount,
        maxAmount:       dto.maxAmount,
        discountPercent: dto.discountPercent,
      });
      const saved = await this.discountRepo.save(tier);
      return new CommonResponse(true, 201, 'Discount tier created', saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tier';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async updateTier(id: number, dto: UpdateDiscountTierDto): Promise<CommonResponse> {
    try {
      const tier = await this.discountRepo.findOne({ where: { id } });
      if (!tier) throw new NotFoundException(`Discount tier ${id} not found`);
      tier.minAmount       = dto.minAmount;
      tier.maxAmount       = dto.maxAmount;
      tier.discountPercent = dto.discountPercent;
      const saved = await this.discountRepo.save(tier);
      return new CommonResponse(true, 200, 'Discount tier updated', saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update tier';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async deleteTier(id: number): Promise<CommonResponse> {
    try {
      const tier = await this.discountRepo.findOne({ where: { id } });
      if (!tier) throw new NotFoundException(`Discount tier ${id} not found`);
      await this.discountRepo.remove(tier);
      return new CommonResponse(true, 200, 'Discount tier deleted', null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete tier';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Returns the INR discount amount for a given customer + order subtotal (0 if no tier matches). */
  async getDiscountForAmount(customerId: string, subtotal: number): Promise<{ discountAmount: number; discountPercent: number }> {
    const tier = await this.discountRepo.findMatchingTier(customerId, subtotal);
    if (!tier) return { discountAmount: 0, discountPercent: 0 };
    const pct = Number(tier.discountPercent);
    const discountAmount = Math.round((subtotal * pct / 100) * 100) / 100;
    return { discountAmount, discountPercent: pct };
  }
}
