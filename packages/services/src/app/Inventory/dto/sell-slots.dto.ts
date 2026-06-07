import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class SellSlotsDto {
  @ApiProperty({ example: [1, 2, 3], description: 'IceSlot IDs to sell' })
  @IsArray()
  @IsInt({ each: true })
  slotIds: number[];

  /** Customer details (mirrors Sale fields). */
  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsString()
  @MinLength(1)
  customerName: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  customerMobile: string;

  @ApiPropertyOptional({ example: 'Sharma Cold Drinks' })
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiPropertyOptional({ description: 'Discount in INR' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiProperty({ example: 'Rahul', description: 'Who processed the sale' })
  @IsString()
  @IsNotEmpty()
  soldBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  time?: string;
}
