import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerOrderItemDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  iceTypeId: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class PlaceOrderDto {
  @ApiProperty({ description: 'Plant/unit name to order from' })
  @IsString()
  unit: string;

  @ApiProperty({ description: 'Customer full name' })
  @IsString()
  name: string;

  @ApiProperty({ description: '10-digit Indian mobile number' })
  @IsString()
  mobile: string;

  @ApiProperty({ description: 'Shop name or delivery address' })
  @IsString()
  address: string;

  @ApiProperty({ type: [CustomerOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerOrderItemDto)
  items: CustomerOrderItemDto[];

  @ApiPropertyOptional({ enum: ['NORMAL', 'ADVANCE'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['NORMAL', 'ADVANCE'])
  orderType?: 'NORMAL' | 'ADVANCE';

  @ApiPropertyOptional({ description: 'Requested delivery date (YYYY-MM-DD) — required for ADVANCE orders' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional({ enum: ['ONLINE', 'COD'], default: 'ONLINE', description: 'Pay now via Razorpay or on delivery' })
  @IsOptional()
  @IsIn(['ONLINE', 'COD'])
  payMode?: 'ONLINE' | 'COD';
}
