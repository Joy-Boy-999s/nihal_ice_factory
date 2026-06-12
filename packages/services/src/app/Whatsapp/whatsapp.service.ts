import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from 'rxjs';
import * as crypto from 'crypto';
import axios from 'axios';
import { UserEntity } from '../user/entities/user.entity';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { CustomerService } from '../Customer/customer.service';
import { IceTypeService } from '../IcePrice/ice-price.service';
import { PlantService } from '../Plant/plant.service';
import { NotificationService } from '../Notification/notification.service';
import { Notification } from '../Notification/entities/notification.entity';

/* ── Meta Cloud API webhook payload (the parts we read) ── */
interface WaMessage {
  from?: string;                       // sender wa_id, e.g. "919398907796"
  type?: string;                       // 'text' | 'image' | ...
  text?: { body?: string };
}

interface WaWebhookPayload {
  entry?: {
    changes?: {
      value?: { messages?: WaMessage[] };
    }[];
  }[];
}

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * WhatsApp ordering — Meta WhatsApp Business Cloud API.
 *
 * Access control: the sender's number must match the `mobile` linked to a
 * registered account (auto-linked the first time a customer places an
 * authenticated order in the app). Unknown numbers get a polite refusal —
 * they cannot order.
 *
 * Ordering reuses CustomerService.placeOrder, so stock checks, FIFO holds,
 * tiered discounts and operator notifications all apply exactly as in-app.
 * WhatsApp orders are COD (no payment collection in chat); customers can
 * still pay online later from My Orders.
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);

  private readonly verifyToken: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly appSecret: string;
  private readonly webUrl: string;
  private mirrorSub: Subscription | null = null;

  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly salesRepo: SalesRepository,
    private readonly customerService: CustomerService,
    private readonly iceTypeService: IceTypeService,
    private readonly plantService: PlantService,
    private readonly notificationService: NotificationService,
    configService: ConfigService,
  ) {
    this.verifyToken   = configService.get<string>('WHATSAPP_VERIFY_TOKEN') ?? '';
    this.accessToken   = configService.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.phoneNumberId = configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.appSecret     = configService.get<string>('WHATSAPP_APP_SECRET') ?? '';
    this.webUrl        = configService.get<string>('APP_WEB_URL') ?? 'https://nihal-ice-factory.vercel.app';
  }

  get configured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  /**
   * Mirror every in-app notification to the recipient's WhatsApp when their
   * account has a linked mobile. Customers get order updates (paid / ready /
   * cancelled) and operators with linked numbers get new-order alerts —
   * no one has to keep the web app open.
   */
  onModuleInit(): void {
    if (!this.configured) return;
    this.mirrorSub = this.notificationService.streamAll().subscribe((n) => {
      void this.mirrorNotification(n);
    });
    this.logger.log('WhatsApp notification mirroring active');
  }

  onModuleDestroy(): void {
    this.mirrorSub?.unsubscribe();
    this.mirrorSub = null;
  }

  private async mirrorNotification(n: Notification): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: n.userId } });
      if (!user?.mobile) return;
      await this.sendText(`91${user.mobile}`, `*${n.title}*\n${n.body}`);
    } catch (err) {
      this.logger.warn(`WhatsApp mirror failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** GET-webhook handshake from Meta when the webhook URL is registered. */
  verifyWebhook(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && this.verifyToken && token === this.verifyToken) {
      return challenge ?? '';
    }
    return null;
  }

  /** X-Hub-Signature-256 — HMAC of the raw body with the Meta app secret. */
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    if (!this.appSecret) return true; // not configured — accept (handshake-only setups)
    if (!rawBody || !signature?.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    return expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /** Entry point for incoming webhook events — never throws. */
  async handleIncoming(payload: WaWebhookPayload): Promise<void> {
    try {
      const messages = (payload.entry ?? [])
        .flatMap((e) => e.changes ?? [])
        .flatMap((c) => c.value?.messages ?? []);

      for (const msg of messages) {
        if (!msg.from) continue;
        if (msg.type !== 'text' || !msg.text?.body) {
          await this.sendText(msg.from, 'Please send a text message. Reply MENU to see what you can order.');
          continue;
        }
        await this.handleText(msg.from, msg.text.body.trim());
      }
    } catch (err) {
      this.logger.error(`WhatsApp handling failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /* ── Conversation ── */

  private async handleText(waId: string, text: string): Promise<void> {
    const mobile = this.normalizeMobile(waId);
    const user = await this.userRepo.findOne({ where: { mobile } });

    // Gate: only registered accounts with a linked number may interact
    if (!user) {
      await this.sendText(
        waId,
        `This number isn't linked to a registered ${'Nihal Ice Factory'} account.\n\n` +
          `Register and place your first order at ${this.webUrl} — after that you can order right here on WhatsApp.`,
      );
      return;
    }

    const lower = text.toLowerCase();
    if (lower.startsWith('order')) {
      await this.handleOrder(waId, user, text);
    } else {
      await this.sendMenu(waId, user);
    }
  }

  private async sendMenu(waId: string, user: UserEntity): Promise<void> {
    const unit = await this.resolvePlant(user);
    if (!unit) {
      await this.sendText(waId, 'No plants are available right now. Please try again later.');
      return;
    }

    const types = await this.iceTypeService.getActiveByPlant(unit);
    const lines = types.map((t) => `• ${t.iceTypeName} (${t.iceTypeCode}) — ₹${t.price}/unit`);

    await this.sendText(
      waId,
      `Hi ${user.username}! 🧊 Ordering from *${unit}*.\n\n` +
        `${lines.join('\n') || 'No ice types configured.'}\n\n` +
        `To order, reply:\n*ORDER <qty> <name or code>*\ne.g. ORDER 5 ${types[0]?.iceTypeCode ?? 'TUBE'}\n\n` +
        `Orders are pay-on-delivery. Your usual discounts apply automatically.\n` +
        `Manage orders: ${this.webUrl}/my-orders`,
    );
  }

  private async handleOrder(waId: string, user: UserEntity, text: string): Promise<void> {
    const match = text.match(/^order\s+(\d+)\s+(.+)$/i);
    if (!match) {
      await this.sendText(waId, 'I couldn\'t read that. Use: *ORDER <qty> <name or code>* — e.g. ORDER 5 TUBE');
      return;
    }

    const quantity = parseInt(match[1], 10);
    const wanted   = match[2].trim().toLowerCase();
    if (!quantity || quantity <= 0 || quantity > 10_000) {
      await this.sendText(waId, 'Please order between 1 and 10000 units.');
      return;
    }

    const unit = await this.resolvePlant(user);
    if (!unit) {
      await this.sendText(waId, 'No plants are available right now. Please try again later.');
      return;
    }

    const types = await this.iceTypeService.getActiveByPlant(unit);
    const iceType = types.find(
      (t) =>
        t.iceTypeCode.toLowerCase() === wanted ||
        t.iceTypeName.toLowerCase() === wanted ||
        t.iceTypeName.toLowerCase().includes(wanted),
    );
    if (!iceType) {
      await this.sendText(
        waId,
        `Couldn't find "${match[2].trim()}" at ${unit}. Reply MENU to see available ice types.`,
      );
      return;
    }

    // Reuse the customer's last delivery details for the order record
    const lastSale = await this.salesRepo.findOne({ where: { customerId: user.id }, order: { id: 'DESC' } });

    const result = await this.customerService.placeOrder(
      {
        unit,
        name:    lastSale?.name ?? user.username,
        mobile:  user.mobile ?? this.normalizeMobile(waId),
        address: lastSale?.shop ?? 'WhatsApp order',
        items:   [{ iceTypeId: iceType.id, quantity }],
        orderType: 'NORMAL',
        payMode:   'COD',
      },
      user.id,
      user.username,
    );

    if (!result.status) {
      await this.sendText(waId, `❌ Order failed: ${result.internalMessage}`);
      return;
    }

    const data = result.data as {
      saleId: number; totalAmount: number; discountAmount: number; discountPercent: number;
    };
    const discountLine = data.discountAmount > 0
      ? `\nDiscount applied: ${data.discountPercent}% (−₹${data.discountAmount})`
      : '';

    await this.sendText(
      waId,
      `✅ Order *#${data.saleId}* placed!\n\n` +
        `${iceType.iceTypeName} × ${quantity} from ${unit}${discountLine}\n` +
        `*Total: ₹${data.totalAmount}* — pay on delivery.\n\n` +
        `The plant has been notified and will prepare your ice.\n` +
        `Track or pay online: ${this.webUrl}/my-orders`,
    );
  }

  /* ── Helpers ── */

  /** Their usual plant (last order), else the first active plant. */
  private async resolvePlant(user: UserEntity): Promise<string | null> {
    const lastSale = await this.salesRepo.findOne({ where: { customerId: user.id }, order: { id: 'DESC' } });
    if (lastSale?.unit) return lastSale.unit;
    const plants = await this.plantService.getAllActive();
    return plants[0]?.plantName ?? null;
  }

  /** wa_id arrives as country code + number ("919398907796") → last 10 digits. */
  private normalizeMobile(waId: string): string {
    const digits = waId.replace(/\D/g, '');
    return digits.slice(-10);
  }

  private async sendText(to: string, body: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn('WhatsApp send skipped — WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID not configured');
      return;
    }
    try {
      await axios.post(
        `${GRAPH_API}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: body.slice(0, 4000), preview_url: false },
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` }, timeout: 10_000 },
      );
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
