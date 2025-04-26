import { IsString } from 'class-validator';

export class SaleIdRequestDto {
  @IsString()
  saleId: string;
}