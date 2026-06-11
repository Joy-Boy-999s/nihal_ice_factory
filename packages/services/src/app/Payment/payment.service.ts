import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentRepository } from './repository/payment.repository';
import { SalesRepository } from '../Sales/repository/sales.repository';

@Injectable()
export class PaymentService {
  private readonly razorpay: Razorpay;
  private readonly keyId: string;

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly salesRepo: SalesRepository,
    private readonly configService: ConfigService,
  ) {
    this.keyId = configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: keySecret });
  }

  async createOrder(dto: CreateOrderDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepo.findOne({ where: { id: dto.saleId } });
      if (!sale) throw new NotFoundException(`Sale ${dto.saleId} not found`);

      const existingPaid = await this.paymentRepo.findOne({
        where: { saleId: dto.saleId, status: 'PAID' },
      });
      if (existingPaid) {
        return new CommonResponse(false, 409, 'This sale has already been paid', existingPaid);
      }

      const amountPaise = Math.round(Number(sale.totalAmount) * 100);

      const order = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `sale_${dto.saleId}_${Date.now()}`,
        notes: {
          saleId: String(dto.saleId),
          customerName: sale.name,
          customerMobile: sale.mobile,
        },
      });

      const payment = this.paymentRepo.create({
        saleId: dto.saleId,
        razorpayOrderId: order.id,
        amount: sale.totalAmount,
        status: 'PENDING',
        customerName: sale.name,
        customerMobile: sale.mobile,
      });
      await this.paymentRepo.save(payment);

      return new CommonResponse(true, 201, 'Order created successfully', {
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: this.keyId,
        customerName: sale.name,
        customerMobile: sale.mobile,
        description: `Payment for Sale #${dto.saleId} — ${sale.shop}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, message, null);
    }
  }

  async verifyPayment(dto: VerifyPaymentDto): Promise<CommonResponse> {
    try {
      const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== dto.razorpaySignature) {
        return new CommonResponse(false, 400, 'Invalid payment signature — possible tampering detected', null);
      }

      const payment = await this.paymentRepo.findOne({
        where: { razorpayOrderId: dto.razorpayOrderId },
      });
      if (!payment) {
        return new CommonResponse(false, 404, 'Payment record not found', null);
      }

      payment.razorpayPaymentId = dto.razorpayPaymentId;
      payment.razorpaySignature = dto.razorpaySignature;
      payment.status = 'PAID';
      await this.paymentRepo.save(payment);

      return new CommonResponse(true, 200, 'Payment verified successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment verification failed';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async getPaymentStatus(saleId: number): Promise<CommonResponse> {
    try {
      const payment = await this.paymentRepo.findOne({
        where: { saleId },
        order: { createdAt: 'DESC' },
      });

      if (!payment) {
        return new CommonResponse(true, 200, 'No payment found for this sale', {
          status: 'NOT_INITIATED',
        });
      }

      return new CommonResponse(true, 200, 'Payment status fetched successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payment status';
      return new CommonResponse(false, 500, message, null);
    }
  }
}
