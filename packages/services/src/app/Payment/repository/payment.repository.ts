import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

/** A payment left PENDING longer than this is considered abandoned. */
export const PENDING_PAYMENT_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PaymentRepository extends Repository<Payment> {
  constructor(dataSource: DataSource) {
    super(Payment, dataSource.createEntityManager());
  }

  /**
   * Marks already-loaded payments FAILED when they have sat in PENDING past
   * the TTL (user closed the checkout without paying — Razorpay never tells
   * the server). Mutates the passed entities so callers return fresh status.
   */
  async expireStalePending(payments: Payment[]): Promise<void> {
    const cutoff = Date.now() - PENDING_PAYMENT_TTL_MS;
    const stale = payments.filter(
      (p) => p.status === 'PENDING' && new Date(p.createdAt).getTime() < cutoff,
    );
    if (stale.length === 0) return;

    await this.update(
      { id: In(stale.map((p) => p.id)) },
      { status: 'FAILED', failureReason: 'Payment not completed (expired)' },
    );
    for (const p of stale) {
      p.status = 'FAILED';
      p.failureReason = 'Payment not completed (expired)';
    }
  }
}
