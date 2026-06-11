import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsPositive, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
