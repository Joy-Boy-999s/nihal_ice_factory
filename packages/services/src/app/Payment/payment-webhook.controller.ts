import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentService } from './payment.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Public endpoint for Razorpay server-to-server webhooks.
 * Auth is the HMAC signature header, verified in PaymentService —
 * deliberately NOT behind the JWT guard.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest,
    @Headers('x-razorpay-signature') signature?: string,
  ): Promise<{ status: string }> {
    return this.paymentService.handleWebhook(req.rawBody, signature);
  }
}
