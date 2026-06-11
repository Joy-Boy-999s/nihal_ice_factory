import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';

@ApiTags('Payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // POST /payment/create-order
  @Post('create-order')
  @ApiBody({ type: CreateOrderDto })
  @ApiOperation({ summary: 'Create a Razorpay payment order for a sale' })
  async createOrder(@Body() dto: CreateOrderDto): Promise<CommonResponse> {
    return this.paymentService.createOrder(dto);
  }

  // POST /payment/verify
  @Post('verify')
  @ApiBody({ type: VerifyPaymentDto })
  @ApiOperation({ summary: 'Verify a Razorpay payment after checkout completes' })
  async verifyPayment(@Body() dto: VerifyPaymentDto): Promise<CommonResponse> {
    return this.paymentService.verifyPayment(dto);
  }

  // GET /payment/status/:saleId
  @Get('status/:saleId')
  @ApiParam({ name: 'saleId', type: Number })
  @ApiOperation({ summary: 'Get payment status for a sale' })
  async getStatus(@Param('saleId', ParseIntPipe) saleId: number): Promise<CommonResponse> {
    return this.paymentService.getPaymentStatus(saleId);
  }
}
