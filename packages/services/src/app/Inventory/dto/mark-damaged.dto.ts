import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class MarkDamagedDto {
  @ApiProperty({ example: [7, 8], description: 'IceSlot IDs to mark as damaged' })
  @IsArray()
  @IsInt({ each: true })
  slotIds: number[];

  @ApiPropertyOptional({ example: 'Cracked during unmoulding' })
  @IsOptional()
  @IsString()
  damageNote?: string;
}
