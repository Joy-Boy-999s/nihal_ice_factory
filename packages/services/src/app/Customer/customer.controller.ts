import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { VerifyPaymentDto } from '../Payment/dto/verify-payment.dto';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'ADMIN')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // GET /customer/shop — browse available plants, ice types, and this customer's discount tiers
  @Get('shop')
  @ApiOperation({ summary: 'Get shop data: all active plants, ice types, and discount tiers' })
  async getShopData(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.customerService.getShopData(user.userId);
  }

  // POST /customer/order — place an order and get a Razorpay checkout order
  @Post('order')
  @ApiBody({ type: PlaceOrderDto })
  @ApiOperation({ summary: 'Place an ice order and receive a Razorpay payment order' })
  async placeOrder(
    @Body() dto: PlaceOrderDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.customerService.placeOrder(dto, user.userId, user.username);
  }

  // POST /customer/verify-payment — verify Razorpay signature after checkout
  @Post('verify-payment')
  @ApiBody({ type: VerifyPaymentDto })
  @ApiOperation({ summary: 'Verify a Razorpay payment for a customer order' })
  async verifyPayment(@Body() dto: VerifyPaymentDto): Promise<CommonResponse> {
    return this.customerService.verifyPayment(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }

  // GET /customer/my-orders — view own order history with payment status
  @Get('my-orders')
  @ApiOperation({ summary: "Fetch the customer's own order history with payment status" })
  async getMyOrders(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.customerService.getMyOrders(user.userId);
  }
}
