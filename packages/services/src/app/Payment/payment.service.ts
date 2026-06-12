import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFailedDto } from './dto/payment-failed.dto';
import { PaymentRepository } from './repository/payment.repository';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { InventoryService } from '../Inventory/inventory.service';
import { NotificationService } from '../Notification/notification.service';
import { PlantService } from '../Plant/plant.service';

/** End of the current local day — paid order holds last until then. */
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly razorpay: Razorpay;
  private readonly keyId: string;

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly salesRepo: SalesRepository,
    private readonly inventoryService: InventoryService,
    private readonly notificationService: NotificationService,
    private readonly plantService: PlantService,
    private readonly configService: ConfigService,
  ) {
    this.keyId = configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: keySecret });
  }

  /** A CUSTOMER may only act on their own sales; staff/admin on any. */
  private customerOwnsSale(
    sale: { customerId?: string | null },
    user?: { userId: string; role: string },
  ): boolean {
    if (!user || user.role !== 'CUSTOMER') return true;
    return sale.customerId === user.userId;
  }

  async createOrder(dto: CreateOrderDto, user?: { userId: string; role: string }): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepo.findOne({ where: { id: dto.saleId } });
      if (!sale) throw new NotFoundException(`Sale ${dto.saleId} not found`);

      if (!this.customerOwnsSale(sale, user)) {
        return new CommonResponse(false, 403, 'You can only pay for your own orders', null);
      }

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
        method: 'RAZORPAY',
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

      await this.onPaymentPaid(payment.saleId);

      return new CommonResponse(true, 200, 'Payment verified successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment verification failed';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async getPaymentStatus(saleId: number, user?: { userId: string; role: string }): Promise<CommonResponse> {
    try {
      if (user?.role === 'CUSTOMER') {
        const sale = await this.salesRepo.findOne({ where: { id: saleId } });
        if (!sale || !this.customerOwnsSale(sale, user)) {
          return new CommonResponse(false, 403, 'You can only view your own orders', null);
        }
      }

      const payment = await this.paymentRepo.findOne({
        where: { saleId },
        order: { createdAt: 'DESC' },
      });

      if (!payment) {
        return new CommonResponse(true, 200, 'No payment found for this sale', {
          status: 'NOT_INITIATED',
        });
      }

      await this.paymentRepo.expireStalePending([payment]);

      return new CommonResponse(true, 200, 'Payment status fetched successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payment status';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Records a cash payment collected at handover (COD orders). Staff only —
   * non-admins must be assigned to the sale's plant.
   */
  async recordCashPayment(
    saleId: number,
    user: { userId: string; username: string; role: string },
  ): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepo.findOne({ where: { id: saleId } });
      if (!sale) return new CommonResponse(false, 404, `Sale ${saleId} not found`, null);
      if (sale.fulfillmentStatus === 'CANCELLED') {
        return new CommonResponse(false, 409, 'Cannot record payment for a cancelled order', null);
      }

      if (user.role !== 'ADMIN') {
        const plants = await this.plantService.getAccessible(user.userId, false);
        if (!plants.some((p) => p.plantName === sale.unit)) {
          return new CommonResponse(false, 403, `Access denied: not assigned to plant "${sale.unit}"`, null);
        }
      }

      const existing = await this.paymentRepo.findOne({
        where: { saleId },
        order: { createdAt: 'DESC' },
      });
      if (existing && (existing.status === 'PAID' || existing.status === 'REFUNDED')) {
        return new CommonResponse(false, 409, `This sale is already ${existing.status.toLowerCase()}`, existing);
      }

      let payment = existing;
      if (payment && payment.status === 'PENDING') {
        // Online attempt superseded by cash at handover
        payment.status = 'PAID';
        payment.method = 'CASH';
        payment.failureReason = null as unknown as string;
      } else {
        payment = this.paymentRepo.create({
          saleId,
          razorpayOrderId: `cash_${saleId}_${Date.now()}`,
          amount: sale.totalAmount,
          status: 'PAID',
          method: 'CASH',
          customerName: sale.name,
          customerMobile: sale.mobile,
        });
      }
      await this.paymentRepo.save(payment);

      if (sale.customerId) {
        await this.notificationService.notifyUsers(
          [sale.customerId],
          'ORDER_PAID',
          `Payment received for order #${sale.id}`,
          `₹${sale.totalAmount} received in cash by ${user.username}. Thank you!`,
          { saleId: sale.id, plantUnit: sale.unit },
        );
      }

      this.logger.log(`Cash payment recorded for sale ${saleId} by ${user.username} (₹${sale.totalAmount})`);
      return new CommonResponse(true, 200, 'Cash payment recorded', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record cash payment';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Records a failed checkout attempt reported by the frontend
   * (Razorpay's `payment.failed` event). Never downgrades a PAID payment —
   * a retry inside the same checkout can still succeed afterwards.
   */
  async markFailed(dto: PaymentFailedDto): Promise<CommonResponse> {
    try {
      const payment = await this.paymentRepo.findOne({
        where: { razorpayOrderId: dto.razorpayOrderId },
      });
      if (!payment) {
        return new CommonResponse(false, 404, 'Payment record not found', null);
      }
      if (payment.status === 'PAID') {
        return new CommonResponse(true, 200, 'Payment already completed', payment);
      }

      payment.status = 'FAILED';
      payment.failureReason = (dto.reason ?? 'Payment failed at checkout').slice(0, 500);
      await this.paymentRepo.save(payment);

      await this.onPaymentFailed(payment.saleId);

      return new CommonResponse(true, 200, 'Payment marked as failed', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record payment failure';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Razorpay server-to-server webhook — the source of truth for payment
   * state. Catches outcomes the browser can't report (closed tab, network
   * drop mid-payment). Configure in the Razorpay dashboard with the secret
   * stored in RAZORPAY_WEBHOOK_SECRET.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ status: string }> {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    if (!secret) {
      this.logger.warn('Webhook received but RAZORPAY_WEBHOOK_SECRET is not configured — ignoring');
      return { status: 'ignored' };
    }
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const valid =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            error_description?: string;
            error_reason?: string;
          };
        };
      };
    };

    const entity  = event.payload?.payment?.entity;
    const orderId = entity?.order_id;
    this.logger.log(`Webhook: ${event.event} order=${orderId ?? '?'} payment=${entity?.id ?? '?'}`);

    if (!orderId) return { status: 'ok' };

    const payment = await this.paymentRepo.findOne({ where: { razorpayOrderId: orderId } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown order ${orderId}`);
      return { status: 'ok' };
    }

    switch (event.event) {
      case 'payment.captured':
      case 'order.paid':
        if (payment.status !== 'PAID') {
          payment.status = 'PAID';
          payment.razorpayPaymentId = entity?.id ?? payment.razorpayPaymentId;
          payment.failureReason = null as unknown as string;
          await this.paymentRepo.save(payment);
          this.logger.log(`Webhook marked payment ${payment.id} (sale ${payment.saleId}) PAID`);
          await this.onPaymentPaid(payment.saleId);
        }
        break;

      case 'payment.failed':
        if (payment.status === 'PENDING') {
          payment.status = 'FAILED';
          payment.failureReason = (entity?.error_description || entity?.error_reason || 'Payment failed').slice(0, 500);
          await this.paymentRepo.save(payment);
          this.logger.log(`Webhook marked payment ${payment.id} (sale ${payment.saleId}) FAILED`);
          await this.onPaymentFailed(payment.saleId);
        }
        break;

      default:
        // Unhandled event types are acknowledged so Razorpay stops retrying
        break;
    }

    return { status: 'ok' };
  }

  /** Post-payment hook: extend the order's stock hold + notify operators. */
  private async onPaymentPaid(saleId: number): Promise<void> {
    try {
      await this.inventoryService.extendReservationForSale(saleId, endOfToday());
      const sale = await this.salesRepo.findOne({ where: { id: saleId } });
      if (sale && sale.customerId) {
        await this.notificationService.notifyPlantOperators(
          sale.unit,
          'ORDER_PAID',
          `Order #${sale.id} paid — ${sale.unit}`,
          `${sale.name} paid ₹${sale.totalAmount} for order #${sale.id}.`,
          { saleId: sale.id },
        );
      }
    } catch (err) {
      this.logger.warn(`onPaymentPaid hook failed for sale ${saleId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Failure hook: release any slots still held for the order. */
  private async onPaymentFailed(saleId: number): Promise<void> {
    try {
      const released = await this.inventoryService.releaseSlotsForSale(saleId);
      if (released > 0) this.logger.log(`Released ${released} held slot(s) for failed sale ${saleId}`);
    } catch (err) {
      this.logger.warn(`onPaymentFailed hook failed for sale ${saleId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
