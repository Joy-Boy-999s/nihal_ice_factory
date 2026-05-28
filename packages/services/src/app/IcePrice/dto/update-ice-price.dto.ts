import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ICE_NAME_REGEX } from '@nihal-ice-factory/shared-models';

export class UpdateIceTypeDto {
  @ApiPropertyOptional({ example: 'Cans', description: 'Human-readable name, 1–50 characters.' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'iceTypeName must not be empty.' })
  @MaxLength(50, { message: 'iceTypeName must not exceed 50 characters.' })
  iceTypeName?: string;

  @ApiPropertyOptional({ example: 'Can', description: 'System code — letters, digits, dot, underscore, hyphen.' })
  @IsOptional()
  @IsString()
  @Matches(ICE_NAME_REGEX, {
    message:
      'iceTypeCode must be 2–50 characters and may only contain letters, digits, dot (.), underscore (_), or hyphen (-).',
  })
  iceTypeCode?: string;

  @ApiPropertyOptional({
    example: 'Unit 1',
    description: 'Factory plant identifier.  Any non-empty string up to 50 characters.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'plantUnit must not be empty.' })
  @MaxLength(50, { message: 'plantUnit must not exceed 50 characters.' })
  plantUnit?: string;

  @ApiPropertyOptional({ example: 260, description: 'Selling price per unit in INR.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(99999)
  price?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
