import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Fire-and-forget — auditing must never break the action being audited. */
  log(
    user: { userId: string; username: string },
    action: string,
    entity: string,
    entityId?: string | number | null,
    detail?: string,
  ): void {
    this.auditRepo
      .save(this.auditRepo.create({
        userId:   user.userId,
        username: user.username,
        action,
        entity,
        entityId: entityId != null ? String(entityId).slice(0, 64) : null,
        detail:   detail ? detail.slice(0, 1000) : null,
      }))
      .catch((err) => this.logger.warn(`Audit write failed: ${err instanceof Error ? err.message : err}`));
  }

  async list(limit = 200): Promise<CommonResponse> {
    try {
      const rows = await this.auditRepo.find({
        order: { id: 'DESC' },
        take: Math.min(Math.max(limit, 1), 500),
      });
      return new CommonResponse(true, 200, 'Audit log fetched', rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit log';
      return new CommonResponse(false, 500, message, null);
    }
  }
}
