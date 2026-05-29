import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePlantDto {
  @ApiPropertyOptional({
    example: 'Unit 2',
    description: 'New plant name — 1 to 100 characters.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'plantName must not be empty.' })
  @MaxLength(100, { message: 'plantName must not exceed 100 characters.' })
  plantName?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Set to false to deactivate the plant.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
