import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../user/entities/user.entity';
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
import { InventoryService } from '../Inventory/inventory.service';
import { NotificationService } from '../Notification/notification.service';
import { In } from 'typeorm';

/** End of the current local day — how long COD / paid order holds last. */
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d;
}

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
    private readonly inventoryService: InventoryService,
    private readonly notificationService: NotificationService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {
    this.keyId = configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: keySecret });
  }

  /**
   * Returns all active plants + their ice types + the customer's discount
   * tiers + live stock per plant/ice type (with expected availability).
   */
  async getShopData(customerId: string): Promise<CommonResponse> {
    try {
      const [plants, iceTypes, discountTiersRes, stock, lastSale] = await Promise.all([
        this.plantService.getAllActive(),
        this.iceTypeService.getActive(),
        this.discountService.getTiers(customerId),
        this.inventoryService.getShopAvailability().catch(() => []),
        this.salesRepo.findOne({ where: { customerId }, order: { id: 'DESC' } }),
      ]);

      const discountTiers = discountTiersRes.status ? (discountTiersRes.data ?? []) : [];

      return new CommonResponse(true, 200, 'Shop data fetched successfully', {
        plants,
        iceTypes,
        discountTiers,
        stock,
        // Prefill for repeat orders — customers shouldn't retype their details
        profile: lastSale
          ? { name: lastSale.name, mobile: lastSale.mobile, address: lastSale.shop }
          : null,
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

      const orderType = dto.orderType ?? 'NORMAL';
      const payMode   = dto.payMode ?? 'ONLINE';

      // ── Advance bookings: delivery date must be in the future ──
      let deliveryDate: string | null = null;
      if (orderType === 'ADVANCE') {
        if (!dto.deliveryDate) {
          return new CommonResponse(false, 400, 'Delivery date is required for advance bookings', null);
        }
        const today = new Date().toISOString().slice(0, 10);
        deliveryDate = dto.deliveryDate.slice(0, 10);
        if (deliveryDate <= today) {
          return new CommonResponse(false, 400, 'Advance bookings must be for a future date', null);
        }
      }

      // ── Normal orders: validate live stock before creating anything ──
      if (orderType === 'NORMAL') {
        const availability = await this.inventoryService.getAvailableCountByType(dto.unit);
        if (availability.size > 0) {
          const shortages = dto.items
            .filter((i) => i.quantity > 0 && availability.has(i.iceTypeId))
            .filter((i) => (availability.get(i.iceTypeId) ?? 0) < i.quantity)
            .map((i) => ({
              iceTypeId: i.iceTypeId,
              iceTypeName: typeMap.get(i.iceTypeId)?.iceTypeName ?? `ID ${i.iceTypeId}`,
              requested: i.quantity,
              available: availability.get(i.iceTypeId) ?? 0,
            }));
          if (shortages.length > 0) {
            const detail = shortages.map((s) => `${s.iceTypeName}: requested ${s.requested}, available ${s.available}`).join('; ');
            return new CommonResponse(false, 409, `Insufficient stock — ${detail}`, { shortages });
          }
        }
      }

      const now  = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);

      // Apply per-customer tiered discount
      const { discountAmount, discountPercent } = await this.discountService.getDiscountForAmount(customerId, subtotal);
      const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

      // Create the sale record (PENDING — awaits operator fulfillment)
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
        orderType,
        deliveryDate,
        payMode,
        fulfillmentStatus: 'PENDING',
      });
      const savedSale = await this.salesRepo.save(sale);

      // Link this mobile to the account (once) — lets WhatsApp recognise them.
      // Authenticated order = verified ownership of the number for our purposes.
      this.userRepo
        .createQueryBuilder()
        .update(UserEntity)
        .set({ mobile: dto.mobile.trim() })
        .where('id = :id AND mobile IS NULL', { id: customerId })
        .execute()
        .catch(() => undefined);

      // ── Normal orders: FIFO-hold the stock for this order ──
      if (orderType === 'NORMAL') {
        // ONLINE holds for the 30-min payment window (extended once paid);
        // COD orders are confirmed immediately, so hold until end of day.
        const reservedUntil = payMode === 'ONLINE' ? new Date(Date.now() + 30 * 60_000) : endOfToday();
        try {
          await this.inventoryService.reserveSlotsForOrder(
            dto.unit,
            dto.items.filter((i) => i.quantity > 0),
            savedSale.id,
            dto.name.trim(),
            reservedUntil,
          );
        } catch (reserveErr) {
          // Race lost between check and reserve — release any slots that were
          // already held for earlier items, then undo the sale.
          await this.inventoryService.releaseSlotsForSale(savedSale.id).catch(() => undefined);
          await this.salesRepo.delete({ id: savedSale.id });
          const msg = reserveErr instanceof Error ? reserveErr.message : 'Insufficient stock';
          return new CommonResponse(false, 409, msg, null);
        }
      }

      // ── Payment: Razorpay order for ONLINE, nothing for COD ──
      let razorpayData: Record<string, unknown> | null = null;
      if (payMode === 'ONLINE') {
        const amountPaise = Math.round(totalAmount * 100);
        try {
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

          const payment = this.paymentRepo.create({
            saleId:          savedSale.id,
            razorpayOrderId: order.id,
            amount:          totalAmount,
            status:          'PENDING',
            customerName:    dto.name,
            customerMobile:  dto.mobile,
          });
          await this.paymentRepo.save(payment);

          razorpayData = {
            orderId:        order.id,
            amount:         amountPaise,
            currency:       'INR',
            keyId:          this.keyId,
            customerName:   dto.name,
            customerMobile: dto.mobile,
            description:    `Ice order #${savedSale.id} — ${dto.address}`,
          };
        } catch (rzErr) {
          // Razorpay unavailable — undo the hold and the sale
          await this.inventoryService.releaseSlotsForSale(savedSale.id);
          await this.salesRepo.delete({ id: savedSale.id });
          const msg = rzErr instanceof Error ? rzErr.message : 'Payment gateway error';
          return new CommonResponse(false, 502, `Could not start payment: ${msg}`, null);
        }
      }

      // ── Notify plant operators (never blocks the order) ──
      const typeLabel = orderType === 'ADVANCE' ? `Advance booking for ${deliveryDate}` : 'New order';
      await this.notificationService.notifyPlantOperators(
        dto.unit,
        'ORDER_PLACED',
        `${typeLabel} #${savedSale.id} — ${dto.unit}`,
        `${dto.name.trim()} ordered ${totalUnits} unit(s) for ₹${totalAmount}` +
          (payMode === 'COD' ? ' (pay on delivery)' : '') +
          (orderType === 'ADVANCE' ? ` — deliver on ${deliveryDate}` : ''),
        { saleId: savedSale.id },
      );

      return new CommonResponse(true, 201, 'Order placed successfully', {
        saleId:          savedSale.id,
        subtotal,
        discountAmount,
        discountPercent,
        totalAmount,
        totalUnits,
        orderType,
        deliveryDate,
        payMode,
        items:    snapshots,
        razorpay: razorpayData,
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

      await this.onPaymentPaid(payment.saleId);

      return new CommonResponse(true, 200, 'Payment verified successfully', payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Post-payment hook: extend the stock hold to end of day + tell the operators. */
  private async onPaymentPaid(saleId: number): Promise<void> {
    try {
      await this.inventoryService.extendReservationForSale(saleId, endOfToday());
      const sale = await this.salesRepo.findOne({ where: { id: saleId } });
      if (sale) {
        await this.notificationService.notifyPlantOperators(
          sale.unit,
          'ORDER_PAID',
          `Order #${sale.id} paid — ${sale.unit}`,
          `${sale.name} paid ₹${sale.totalAmount} for order #${sale.id}.`,
          { saleId: sale.id },
        );
      }
    } catch {
      // hooks must never break payment verification
    }
  }

  /**
   * Cancels a customer order: releases held stock, refunds online payments
   * via Razorpay, and notifies the plant. Fulfilled orders cannot be
   * cancelled. Customers may only cancel their own orders.
   */
  async cancelOrder(
    saleId: number,
    user: { userId: string; username: string; role: string },
  ): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepo.findOne({ where: { id: saleId } });
      if (!sale) return new CommonResponse(false, 404, `Order ${saleId} not found`, null);
      if (!sale.customerId) {
        return new CommonResponse(false, 400, 'Only customer orders can be cancelled here', null);
      }
      if (user.role === 'CUSTOMER' && sale.customerId !== user.userId) {
        return new CommonResponse(false, 403, 'You can only cancel your own orders', null);
      }
      if (sale.fulfillmentStatus === 'CANCELLED') {
        return new CommonResponse(false, 409, 'Order is already cancelled', null);
      }
      if (sale.fulfillmentStatus === 'FULFILLED') {
        return new CommonResponse(false, 409, 'Order has already been handed over — contact the factory for returns', null);
      }

      const payment = await this.paymentRepo.findOne({
        where: { saleId },
        order: { createdAt: 'DESC' },
      });

      // Refund FIRST — if Razorpay rejects it, the order stays active so the
      // customer can retry instead of losing both the ice and the money.
      let refundId: string | null = null;
      if (payment?.status === 'PAID' && payment.razorpayPaymentId) {
        try {
          const refund = (await this.razorpay.payments.refund(payment.razorpayPaymentId, {
            speed: 'normal',
            notes: { reason: `Order #${saleId} cancelled by ${user.username}` },
          })) as { id?: string };
          refundId = refund?.id ?? null;

          payment.status = 'REFUNDED';
          payment.razorpayRefundId = refundId ?? '';
          await this.paymentRepo.save(payment);
        } catch (refundErr) {
          const msg = refundErr instanceof Error ? refundErr.message : 'Refund failed';
          return new CommonResponse(false, 502, `Could not process refund — order not cancelled. ${msg}`, null);
        }
      } else if (payment?.status === 'PENDING') {
        payment.status = 'FAILED';
        payment.failureReason = 'Order cancelled';
        await this.paymentRepo.save(payment);
      }

      // Free any stock still held for this order
      await this.inventoryService.releaseSlotsForSale(saleId).catch(() => undefined);

      sale.fulfillmentStatus = 'CANCELLED';
      sale.cancelledBy = user.username;
      sale.cancelledAt = new Date();
      await this.salesRepo.save(sale);

      // Notify the plant; if an admin cancelled, also tell the customer
      await this.notificationService.notifyPlantOperators(
        sale.unit,
        'ORDER_CANCELLED',
        `Order #${sale.id} cancelled — ${sale.unit}`,
        `${sale.name}'s order for ${sale.totalUnits} unit(s) was cancelled by ${user.username}` +
          (refundId ? ` — ₹${sale.totalAmount} refunded` : ''),
        { saleId: sale.id },
      );
      if (user.role !== 'CUSTOMER') {
        await this.notificationService.notifyUsers(
          [sale.customerId],
          'ORDER_CANCELLED',
          `Order #${sale.id} was cancelled`,
          `Your order was cancelled by the factory.` + (refundId ? ` ₹${sale.totalAmount} has been refunded.` : ''),
          { saleId: sale.id, plantUnit: sale.unit },
        );
      }

      return new CommonResponse(true, 200, refundId ? 'Order cancelled and refund initiated' : 'Order cancelled', {
        saleId: sale.id,
        fulfillmentStatus: sale.fulfillmentStatus,
        paymentStatus: payment?.status ?? 'NOT_INITIATED',
        refundId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order';
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

      // Abandoned checkouts (PENDING past TTL) become FAILED
      await this.paymentRepo.expireStalePending(payments);

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
