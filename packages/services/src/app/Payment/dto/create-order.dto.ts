import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'ID of the sale to pay for' })
  @IsNumber()
  @IsPositive()
  saleId: number;
}
