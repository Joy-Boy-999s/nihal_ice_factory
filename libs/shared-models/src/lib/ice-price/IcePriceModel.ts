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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

/**
 * Regex for ice-type codes:  letters, digits, dot, underscore, hyphen.
 * Min 2, max 50 characters.  No spaces.
 * Examples:  Can  |  Block  |  Piece  |  Can-Large  |  Block_5kg
 */
export const ICE_NAME_REGEX = /^[A-Za-z0-9._-]{2,50}$/;

// ────────────────────────────────────────────────────────────────────────────
// Response DTO — returned by the API and consumed by the UI
// ────────────────────────────────────────────────────────────────────────────

/** Represents one ice unit-type entry with its price at a specific factory plant. */
export class IceTypeDto {
  id: number;
  /** Human-readable label (e.g. "Cans", "Blocks", "Pieces"). */
  iceTypeName: string;
  /** System code, no spaces (e.g. "Can", "Block", "Piece"). */
  iceTypeCode: string;
  /** Factory plant this price belongs to (e.g. "Unit 1", "Unit 2"). */
  plantUnit: string;
  /** Selling price per unit in INR. */
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Keep old name as alias so any stale imports compile during migration.
/** @deprecated Use IceTypeDto */
export type IcePriceDto = IceTypeDto;

// ────────────────────────────────────────────────────────────────────────────
// Create request DTO
// ────────────────────────────────────────────────────────────────────────────

export class CreateIceTypeDto {
  @ApiProperty({
    example: 'Cans',
    description: 'Human-readable name shown in the UI (e.g. "Cans", "Blocks", "Pieces").  1–50 characters.',
  })
  @IsString()
  @MinLength(1, { message: 'iceTypeName must not be empty.' })
  @MaxLength(50, { message: 'iceTypeName must not exceed 50 characters.' })
  iceTypeName: string;

  @ApiProperty({
    example: 'Can',
    description:
      'System code — letters, digits, dot, underscore, hyphen.  No spaces.  2–50 chars.  ' +
      'Examples: Can, Block, Piece, Can-Large',
  })
  @IsString()
  @Matches(ICE_NAME_REGEX, {
    message:
      'iceTypeCode must be 2–50 characters containing only letters, digits, dot (.), underscore (_), or hyphen (-).',
  })
  iceTypeCode: string;

  @ApiProperty({
    example: 'Unit 1',
    description:
      'Factory plant this price applies to.  Any non-empty string up to 50 characters.',
  })
  @IsString()
  @MinLength(1, { message: 'plantUnit must not be empty.' })
  @MaxLength(50, { message: 'plantUnit must not exceed 50 characters.' })
  plantUnit: string;

  @ApiProperty({ example: 240, description: 'Selling price per unit in INR.' })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(99999)
  price: number;
}

/** @deprecated Use CreateIceTypeDto */
export type CreateIcePriceDto = CreateIceTypeDto;

// ────────────────────────────────────────────────────────────────────────────
// Update request DTO — all fields optional
// ────────────────────────────────────────────────────────────────────────────

export class UpdateIceTypeDto {
  @ApiPropertyOptional({ example: 'Cans' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'iceTypeName must not be empty.' })
  @MaxLength(50, { message: 'iceTypeName must not exceed 50 characters.' })
  iceTypeName?: string;

  @ApiPropertyOptional({ example: 'Can' })
  @IsOptional()
  @IsString()
  @Matches(ICE_NAME_REGEX, {
    message:
      'iceTypeCode must be 2–50 characters containing only letters, digits, dot (.), underscore (_), or hyphen (-).',
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

/** @deprecated Use UpdateIceTypeDto */
export type UpdateIcePriceDto = UpdateIceTypeDto;
