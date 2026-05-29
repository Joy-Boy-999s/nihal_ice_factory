import { IsOptional, IsString, IsNumber, IsArray, Min } from 'class-validator';
import { SaleItemInput } from './create-sale.dto';

export class SaleUpdateDto {
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  shop?: string;

  /** Replaced line items — if provided, replaces the entire items list. */
  @IsArray()
  @IsOptional()
  items?: SaleItemInput[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  soldBy?: string;
}
