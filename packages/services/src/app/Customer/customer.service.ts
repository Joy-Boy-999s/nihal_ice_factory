import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { PlaceOrderDto } from './dto/place-order.dto';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { PaymentRepository } from '../Payment/repository/payment.repository';
import { IceTypeService } from '../IcePrice/ice-price.service';
import { PlantService } from '../Plant/plant.service';
import { CustomerDiscountService } from '../CustomerDiscount/customer-discount.service';
import { IceType } from '../IcePrice/entities/ice-price.entity';
import { SaleItemSnapshot } from '../Sales/entities/sale.entity';
import { In } from 'typeorm';

@Injectable()
export class CustomerService {
  private readonly razorpay: Razorpay;
  private readonly keyId: string;

  constructor(
    private readonly salesRepo: SalesRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly iceTypeService: IceTypeService,
    private readonly plantService: PlantService,
    private readonly discountService: CustomerDiscountService,
    private readonly configService: ConfigService,
  ) {
    this.keyId = configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: keySecret });
  }

  /** Returns all active plants + their ice types for the shop page. */
  async getShopData(): Promise<CommonResponse> {
    try {
      const [plants, iceTypes] = await Promise.all([
        this.plantService.getAllActive(),
        this.iceTypeService.getActive(),
      ]);

      return new CommonResponse(true, 200, 'Shop data fetched successfully', {
        plants,
        iceTypes,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch shop data';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Place a customer order: creates a Sale + Razorpay payment order atomically. */
  async placeOrder(dto: PlaceOrderDto, customerId: string, customerUsername: string): Promise<CommonResponse> {
    try {
      // Build items snapshot from ice type master
      const activeTypes = await this.iceTypeService.getActiveByPlant(dto.unit);
      if (activeTypes.length === 0) {
        return new CommonResponse(false, 400, `No active ice types found for plant "${dto.unit}"`, null);
      }

      const typeMap = new Map<number, IceType>(activeTypes.map((t) => [t.id, t]));
      const snapshots: SaleItemSnapshot[] = [];
      let totalUnits = 0;
      let subtotal = 0;

      for (const item of dto.items) {
        const iceType = typeMap.get(item.iceTypeId);
        if (!iceType) {
          return new CommonResponse(false, 400, `Ice type ID ${item.iceTypeId} is not available for plant "${dto.unit}"`, null);
        }
        const price = Number(iceType.price);
        const itemSubtotal = item.quantity * price;
        snapshots.push({
          iceTypeId:   iceType.id,
          iceTypeName: iceType.iceTypeName,
          iceTypeCode: iceType.iceTypeCode,
          quantity:    item.quantity,
          price,
          subtotal:    itemSubtotal,
        });
        totalUnits += item.quantity;
        subtotal   += itemSubtotal;
      }

      const hasItems = snapshots.some((s) => s.quantity > 0);
      if (!hasItems) {
        return new CommonResponse(false, 400, 'At least one item must have quantity > 0', null);
      }

      const now  = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);

      // Apply per-customer tiered discount
      const { discountAmount, discountPercent } = await this.discountService.getDiscountForAmount(customerId, subtotal);
      const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

      // Create the sale record
      const sale = this.salesRepo.create({
        date,
        time,
        unit:       dto.unit,
        name:       dto.name.trim(),
        mobile:     dto.mobile.trim(),
        shop:       dto.address.trim(),
        soldBy:     customerUsername,
        discount:   discountAmount,
        items:      snapshots,
        totalUnits,
        totalAmount,
        customerId,
      });
      const savedSale = await this.salesRepo.save(sale);

      // Create Razorpay order (discounted amount in paise)
      const amountPaise = Math.round(totalAmount * 100);
      const order = await this.razorpay.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  `cust_${savedSale.id}_${Date.now()}`,
        notes: {
          saleId:   String(savedSale.id),
          customer: dto.name,
          mobile:   dto.mobile,
        },
      });

      // Persist pending payment record
      const payment = this.paymentRepo.create({
        saleId:          savedSale.id,
        razorpayOrderId: order.id,
        amount:          totalAmount,
        status:          'PENDING',
        customerName:    dto.name,
        customerMobile:  dto.mobile,
      });
      await this.paymentRepo.save(payment);

      return new CommonResponse(true, 201, 'Order placed successfully', {
        saleId:          savedSale.id,
        subtotal,
        discountAmount,
        discountPercent,
        totalAmount,
        totalUnits,
        items:       snapshots,
        razorpay: {
          orderId:      order.id,
          amount:       amountPaise,
          currency:     'INR',
          keyId:        this.keyId,
          customerName: dto.name,
          customerMobile: dto.mobile,
          description:  `Ice order #${savedSale.id} — ${dto.address}`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place order';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Verify a Razorpay payment by HMAC signature. */
  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<CommonResponse> {
    try {
      const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
      const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expected !== razorpaySignature) {
        return new CommonResponse(false, 400, 'Invalid payment signature', null);
      }

      const payment = await this.paymentRepo.findOne({ where: { razorpayOrderId } });
      if (!payment) return new CommonResponse(false, 404, 'Payment record not found', null);

      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'PAID';
      await this.paymentRepo.save(payment);

      return new CommonResponse(true, 200, 'Payment verified successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Returns all orders placed by a customer, with payment status. */
  async getMyOrders(customerId: string): Promise<CommonResponse> {
    try {
      const sales = await this.salesRepo.find({
        where: { customerId },
        order: { id: 'DESC' },
      });

      if (sales.length === 0) {
        return new CommonResponse(true, 200, 'No orders found', []);
      }

      const saleIds = sales.map((s) => s.id);
      const payments = await this.paymentRepo.find({
        where: { saleId: In(saleIds) },
        order: { createdAt: 'DESC' },
      });

      // Map latest payment per saleId
      const paymentBySaleId = new Map<number, (typeof payments)[0]>();
      for (const p of payments) {
        if (!paymentBySaleId.has(p.saleId)) {
          paymentBySaleId.set(p.saleId, p);
        }
      }

      const orders = sales.map((sale) => ({
        ...sale,
        payment: paymentBySaleId.get(sale.id) ?? null,
        paymentStatus: paymentBySaleId.get(sale.id)?.status ?? 'NOT_INITIATED',
      }));

      return new CommonResponse(true, 200, 'Orders fetched successfully', orders);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      return new CommonResponse(false, 500, message, null);
    }
  }
}
