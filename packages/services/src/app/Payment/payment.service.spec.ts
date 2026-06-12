/* eslint-disable @typescript-eslint/no-explicit-any */
/* vitest globals (describe/it/expect/vi) — enabled via vitest.config.ts */
import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';

const WEBHOOK_SECRET = 'test_webhook_secret';

/** Builds a service instance with hand-rolled mocks — no Nest container needed. */
function buildService(overrides: { secret?: string | null } = {}) {
  const payment: Partial<Payment> = {
    id: 1,
    saleId: 42,
    razorpayOrderId: 'order_abc',
    status: 'PENDING',
    amount: 500,
  };

  const paymentRepo = {
    findOne: vi.fn().mockResolvedValue(payment),
    save: vi.fn().mockImplementation(async (p) => p),
  };
  const salesRepo = {
    findOne: vi.fn().mockResolvedValue({
      id: 42, unit: 'Unit 1', name: 'Test Shop', totalAmount: 500, customerId: 'cust-1',
    }),
  };
  const inventoryService = {
    extendReservationForSale: vi.fn().mockResolvedValue(1),
    releaseSlotsForSale: vi.fn().mockResolvedValue(1),
  };
  const notificationService = {
    notifyPlantOperators: vi.fn().mockResolvedValue(undefined),
    notifyUsers: vi.fn().mockResolvedValue(undefined),
  };
  const plantService = {};
  const configService = {
    get: (key: string) =>
      ({
        RAZORPAY_KEY_ID: 'rzp_test_key',
        RAZORPAY_KEY_SECRET: 'rzp_test_secret',
        RAZORPAY_WEBHOOK_SECRET: overrides.secret === null ? undefined : (overrides.secret ?? WEBHOOK_SECRET),
      }[key]),
  };

  const service = new PaymentService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentRepo as any, salesRepo as any, inventoryService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notificationService as any, plantService as any, configService as any,
  );

  return { service, payment, paymentRepo, inventoryService, notificationService };
}

function signedBody(event: object, secret = WEBHOOK_SECRET): { rawBody: Buffer; signature: string } {
  const rawBody = Buffer.from(JSON.stringify(event));
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return { rawBody, signature };
}

describe('PaymentService.handleWebhook', () => {
  it('rejects an invalid signature', async () => {
    const { service } = buildService();
    const { rawBody } = signedBody({ event: 'payment.captured' });
    const badSig = crypto.createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');

    await expect(service.handleWebhook(rawBody, badSig)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a missing signature', async () => {
    const { service } = buildService();
    const { rawBody } = signedBody({ event: 'payment.captured' });

    await expect(service.handleWebhook(rawBody, undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('ignores deliveries when no webhook secret is configured', async () => {
    const { service, paymentRepo } = buildService({ secret: null });
    const { rawBody, signature } = signedBody({ event: 'payment.captured' });

    const res = await service.handleWebhook(rawBody, signature);
    expect(res).toEqual({ status: 'ignored' });
    expect(paymentRepo.findOne).not.toHaveBeenCalled();
  });

  it('marks a pending payment PAID on payment.captured and extends the stock hold', async () => {
    const { service, payment, paymentRepo, inventoryService, notificationService } = buildService();
    const { rawBody, signature } = signedBody({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_abc' } } },
    });

    const res = await service.handleWebhook(rawBody, signature);

    expect(res).toEqual({ status: 'ok' });
    expect(payment.status).toBe('PAID');
    expect(payment.razorpayPaymentId).toBe('pay_123');
    expect(paymentRepo.save).toHaveBeenCalled();
    expect(inventoryService.extendReservationForSale).toHaveBeenCalledWith(42, expect.any(Date));
    expect(notificationService.notifyPlantOperators).toHaveBeenCalled();
  });

  it('marks a pending payment FAILED on payment.failed and releases held slots', async () => {
    const { service, payment, inventoryService } = buildService();
    const { rawBody, signature } = signedBody({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_abc', error_description: 'Card declined' } } },
    });

    const res = await service.handleWebhook(rawBody, signature);

    expect(res).toEqual({ status: 'ok' });
    expect(payment.status).toBe('FAILED');
    expect(payment.failureReason).toBe('Card declined');
    expect(inventoryService.releaseSlotsForSale).toHaveBeenCalledWith(42);
  });

  it('never downgrades a PAID payment on payment.failed', async () => {
    const { service, payment, paymentRepo, inventoryService } = buildService();
    payment.status = 'PAID';
    const { rawBody, signature } = signedBody({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_abc' } } },
    });

    await service.handleWebhook(rawBody, signature);

    expect(payment.status).toBe('PAID');
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(inventoryService.releaseSlotsForSale).not.toHaveBeenCalled();
  });

  it('acknowledges unknown orders without crashing', async () => {
    const { service, paymentRepo } = buildService();
    paymentRepo.findOne.mockResolvedValue(null);
    const { rawBody, signature } = signedBody({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_999', order_id: 'order_unknown' } } },
    });

    const res = await service.handleWebhook(rawBody, signature);
    expect(res).toEqual({ status: 'ok' });
  });
});
