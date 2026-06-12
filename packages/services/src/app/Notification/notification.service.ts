import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { Notification, NotificationData, NotificationType } from './entities/notification.entity';
import { Plant } from '../Plant/entities/plant.entity';
import { UserPlantAccess } from '../Plant/entities/user-plant-access.entity';
import { UserEntity } from '../user/entities/user.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** In-memory live feed — each saved notification is pushed here for SSE. */
  private readonly stream$ = new Subject<Notification>();

  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Plant) private readonly plantRepo: Repository<Plant>,
    @InjectRepository(UserPlantAccess) private readonly accessRepo: Repository<UserPlantAccess>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** Live notifications for one user (used by the SSE endpoint). */
  streamFor(userId: string): Observable<Notification> {
    return this.stream$.asObservable().pipe(filter((n) => n.userId === userId));
  }

  /** Every notification, all recipients — used by channel mirrors (WhatsApp). */
  streamAll(): Observable<Notification> {
    return this.stream$.asObservable();
  }

  /**
   * Persists one notification per recipient and pushes them to the live
   * stream. Swallows errors — notifying must never break a business flow.
   */
  async notifyUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: NotificationData,
  ): Promise<void> {
    try {
      const unique = [...new Set(userIds.filter(Boolean))];
      if (unique.length === 0) return;

      const rows = unique.map((userId) =>
        this.notifRepo.create({ userId, type, title, body, data: data ?? null }),
      );
      const saved = await this.notifRepo.save(rows);
      for (const n of saved) this.stream$.next(n);
    } catch (err) {
      this.logger.error(`notifyUsers failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Notifies every operator assigned to the plant plus all admins.
   * Operators are resolved via user_plant_access; admins always included.
   */
  async notifyPlantOperators(
    plantUnit: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: NotificationData,
  ): Promise<void> {
    try {
      const plant = await this.plantRepo.findOne({ where: { plantName: plantUnit } });

      const operatorIds = plant
        ? (await this.accessRepo.find({ where: { plantId: plant.id } })).map((a) => a.userId)
        : [];

      const admins = await this.userRepo
        .createQueryBuilder('u')
        .select('u.id', 'id')
        .where('LOWER(u.role) = :role', { role: 'admin' })
        .getRawMany<{ id: string }>();

      await this.notifyUsers(
        [...operatorIds, ...admins.map((a) => a.id)],
        type,
        title,
        body,
        { ...data, plantUnit },
      );
    } catch (err) {
      this.logger.error(`notifyPlantOperators failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async list(userId: string, limit = 50): Promise<CommonResponse> {
    try {
      const rows = await this.notifRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: Math.min(Math.max(limit, 1), 100),
      });
      return new CommonResponse(true, 200, 'Notifications fetched', rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async unreadCount(userId: string): Promise<CommonResponse> {
    try {
      const count = await this.notifRepo.count({ where: { userId, isRead: false } });
      return new CommonResponse(true, 200, 'Unread count fetched', { count });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch unread count';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async markRead(userId: string, id: number): Promise<CommonResponse> {
    try {
      await this.notifRepo.update({ id, userId }, { isRead: true });
      return new CommonResponse(true, 200, 'Notification marked read', { id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark read';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async markAllRead(userId: string): Promise<CommonResponse> {
    try {
      await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
      return new CommonResponse(true, 200, 'All notifications marked read', null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all read';
      return new CommonResponse(false, 500, message, null);
    }
  }
}
