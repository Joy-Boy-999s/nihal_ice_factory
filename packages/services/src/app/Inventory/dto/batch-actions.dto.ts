import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarkBatchReadyDto {
  @ApiPropertyOptional({ example: '2026-06-07T14:00:00.000Z' })
  @IsOptional()
  @IsString()
  readyAt?: string;

  @ApiPropertyOptional({ description: 'Hours of shelf life after readyAt (default 24)' })
  @IsOptional()
  shelfLifeHours?: number;
}

export class SetNextBatchDto {
  @ApiProperty({ example: '2026-06-07T22:00:00.000Z', description: 'When the next batch is expected to be ready' })
  @IsString()
  estimatedNextBatchAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
