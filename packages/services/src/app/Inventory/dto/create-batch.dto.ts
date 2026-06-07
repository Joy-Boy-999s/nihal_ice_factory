import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ example: 'Unit 1' })
  @IsString()
  @IsNotEmpty()
  plantUnit: string;

  @ApiProperty({ example: 3, description: 'ice_types.id' })
  @IsInt()
  iceTypeId: number;

  @ApiProperty({ example: 'Morning Batch', description: 'Human label for this batch' })
  @IsString()
  @MinLength(1)
  batchLabel: string;

  @ApiProperty({ example: 5, description: 'Number of rows in the ice grid' })
  @IsInt()
  @Min(1)
  @Max(50)
  rows: number;

  @ApiProperty({ example: 10, description: 'Number of columns per row' })
  @IsInt()
  @Min(1)
  @Max(50)
  cols: number;

  @ApiPropertyOptional({ example: '2026-06-07T06:00:00.000Z' })
  @IsOptional()
  @IsString()
  productionStartedAt?: string;

  @ApiPropertyOptional({ example: '2026-06-07T14:00:00.000Z', description: 'When ice is expected to be ready' })
  @IsOptional()
  @IsString()
  readyAt?: string;

  @ApiPropertyOptional({ description: 'Hours of shelf life after readyAt (default 24)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  shelfLifeHours?: number;

  @ApiPropertyOptional({ example: 'First batch of the day' })
  @IsOptional()
  @IsString()
  notes?: string;
}
