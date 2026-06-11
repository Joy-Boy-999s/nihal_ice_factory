export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'NOT_INITIATED';

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  customerName: string;
  customerMobile: string;
  description: string;
}

export interface PaymentRecord {
  id: number;
  saleId: number;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  status: PaymentStatus;
  customerName: string;
  customerMobile: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStatusResponse {
  status: PaymentStatus;
}
