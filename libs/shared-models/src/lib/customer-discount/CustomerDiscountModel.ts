export class CreateDiscountTierDto {
  customerId!: string;
  minAmount!: number;
  maxAmount!: number;
  discountPercent!: number;
}

export class UpdateDiscountTierDto {
  minAmount!: number;
  maxAmount!: number;
  discountPercent!: number;
}

export interface DiscountTier {
  id: number;
  customerId: string;
  minAmount: number;
  maxAmount: number;
  discountPercent: number;
}
