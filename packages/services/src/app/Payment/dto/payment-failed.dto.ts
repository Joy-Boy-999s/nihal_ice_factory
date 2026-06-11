import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentFailedDto {
  @ApiProperty({ description: 'Razorpay order id of the failed payment attempt' })
  @IsString()
  razorpayOrderId: string;

  @ApiPropertyOptional({ description: 'Failure reason reported by Razorpay checkout' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
