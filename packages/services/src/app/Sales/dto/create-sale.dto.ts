import { IsString, IsNumber, IsDateString, IsIn, Min, IsOptional } from 'class-validator';

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsString()
  time: string;

  @IsString()
  @IsIn(['Unit 1', 'Unit 2', 'Unit 3'])
  unit: string;

  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsString()
  shop: string;

  @IsNumber()
  @Min(0)
  cans: number;

  @IsNumber()
  @Min(0)
  blocks: number;

  @IsNumber()
  @Min(0)
  pieces: number;

  @IsNumber()
  @Min(0)
  totalCans: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsString()
  soldBy: string;
}