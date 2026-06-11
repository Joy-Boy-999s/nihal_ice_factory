import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator';

export class FulfillOrderDto {
  @ApiProperty({ description: 'Sale id of the customer order being fulfilled' })
  @IsInt()
  @IsPositive()
  saleId: number;

  @ApiProperty({ type: [Number], description: 'Slot ids handed over to the customer' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  slotIds: number[];
}
