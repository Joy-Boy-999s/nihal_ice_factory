import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFailedDto } from './dto/payment-failed.dto';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';
import { AuditService } from '../Audit/audit.service';

@ApiTags('Payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
  ) {}

  // POST /payment/create-order
  @Post('create-order')
  @ApiBody({ type: CreateOrderDto })
  @ApiOperation({ summary: 'Create a Razorpay payment order for a sale' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.paymentService.createOrder(dto, user);
  }

  // POST /payment/verify
  @Post('verify')
  @ApiBody({ type: VerifyPaymentDto })
  @ApiOperation({ summary: 'Verify a Razorpay payment after checkout completes' })
  async verifyPayment(@Body() dto: VerifyPaymentDto): Promise<CommonResponse> {
    return this.paymentService.verifyPayment(dto);
  }

  // POST /payment/failed
  @Post('failed')
  @ApiBody({ type: PaymentFailedDto })
  @ApiOperation({ summary: 'Record a failed Razorpay checkout attempt' })
  async paymentFailed(@Body() dto: PaymentFailedDto): Promise<CommonResponse> {
    return this.paymentService.markFailed(dto);
  }

  // POST /payment/record-cash/:saleId — staff records cash collected at handover
  @Post('record-cash/:saleId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER')
  @ApiParam({ name: 'saleId', type: Number })
  @ApiOperation({ summary: 'Record a cash (pay-on-delivery) payment for a sale' })
  async recordCash(
    @Param('saleId', ParseIntPipe) saleId: number,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    const res = await this.paymentService.recordCashPayment(saleId, user);
    if (res.status) this.auditService.log(user, 'CASH_RECORDED', 'payment', saleId);
    return res;
  }

  // GET /payment/status/:saleId
  @Get('status/:saleId')
  @ApiParam({ name: 'saleId', type: Number })
  @ApiOperation({ summary: 'Get payment status for a sale' })
  async getStatus(
    @Param('saleId', ParseIntPipe) saleId: number,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.paymentService.getPaymentStatus(saleId, user);
  }
}
