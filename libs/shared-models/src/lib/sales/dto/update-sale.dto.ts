// src/sales/dto/sale-update.dto.ts

import { IsOptional, IsString, IsNumber } from 'class-validator';

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

  @IsNumber()
  @IsOptional()
  cans?: number;

  @IsNumber()
  @IsOptional()
  blocks?: number;

  @IsNumber()
  @IsOptional()
  pieces?: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  soldBy?: string;
}
