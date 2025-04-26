import { IsString, IsNumber, IsDateString, IsIn, Min, IsOptional } from 'class-validator';

export class UpdateSaleDto {
  @IsString()
  saleId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Unit 1', 'Unit 2', 'Unit 3'])
  unit?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  shop?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  blocks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pieces?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  soldBy?: string;
}