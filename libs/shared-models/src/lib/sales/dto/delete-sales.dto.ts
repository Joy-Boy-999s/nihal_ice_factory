// src/sales/dto/delete-sales.dto.ts
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class DeleteSalesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  ids: number[];
}
