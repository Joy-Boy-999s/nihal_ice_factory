import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemInput {
  @IsNumber()
  @Min(1)
  iceTypeId: number;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsString()
  time: string;

  @IsString()
  unit: string;

  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsString()
  shop: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required.' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items: SaleItemInput[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsString()
  soldBy: string;
}
