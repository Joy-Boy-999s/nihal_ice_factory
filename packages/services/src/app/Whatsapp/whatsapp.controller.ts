import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { WhatsappService } from './whatsapp.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Meta WhatsApp Cloud API webhook. Public on purpose:
 * - GET is Meta's one-time verification handshake (verify token).
 * - POST is HMAC-verified against the app secret before processing.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (result === null) throw new ForbiddenException('Webhook verification failed');
    return result;
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handle(
    @Req() req: RawBodyRequest,
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature?: string,
  ): { status: string } {
    if (!this.whatsappService.verifySignature(req.rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    // Respond 200 immediately; processing (DB + replies) continues async so
    // Meta never times out and retries duplicate deliveries.
    void this.whatsappService.handleIncoming(body as Parameters<WhatsappService['handleIncoming']>[0]);
    return { status: 'ok' };
  }
}
