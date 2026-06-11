import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CustomerDiscountService } from './customer-discount.service';
import { CreateDiscountTierDto, UpdateDiscountTierDto } from './dto/create-discount-tier.dto';

@ApiTags('CustomerDiscount')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('customer-discount')
export class CustomerDiscountController {
  constructor(private readonly discountService: CustomerDiscountService) {}

  @Get(':customerId')
  @ApiOperation({ summary: 'Get all discount tiers for a customer' })
  async getTiers(@Param('customerId') customerId: string): Promise<CommonResponse> {
    return this.discountService.getTiers(customerId);
  }

  @Post()
  @ApiBody({ type: CreateDiscountTierDto })
  @ApiOperation({ summary: 'Create a discount tier for a customer' })
  async createTier(@Body() dto: CreateDiscountTierDto): Promise<CommonResponse> {
    return this.discountService.createTier(dto);
  }

  @Put(':id')
  @ApiBody({ type: UpdateDiscountTierDto })
  @ApiOperation({ summary: 'Update a discount tier' })
  async updateTier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountTierDto,
  ): Promise<CommonResponse> {
    return this.discountService.updateTier(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a discount tier' })
  async deleteTier(@Param('id', ParseIntPipe) id: number): Promise<CommonResponse> {
    return this.discountService.deleteTier(id);
  }
}
