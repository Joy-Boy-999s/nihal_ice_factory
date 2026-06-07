import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ReserveSlotsDto {
  @ApiProperty({ example: [4, 5], description: 'IceSlot IDs to reserve' })
  @IsArray()
  @IsInt({ each: true })
  slotIds: number[];

  @ApiProperty({ example: 'Priya Stores' })
  @IsString()
  @IsNotEmpty()
  reservedFor: string;

  @ApiPropertyOptional({ example: 60, description: 'Minutes until reservation auto-expires (default 30)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInMinutes?: number;
}

export class ReleaseSlotsDto {
  @ApiProperty({ example: [4, 5], description: 'IceSlot IDs to release back to available' })
  @IsArray()
  @IsInt({ each: true })
  slotIds: number[];
}
