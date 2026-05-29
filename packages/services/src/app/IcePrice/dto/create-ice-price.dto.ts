import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ICE_NAME_REGEX } from '@nihal-ice-factory/shared-models';

export class CreateIceTypeDto {
  @ApiProperty({
    example: 'Cans',
    description: 'Human-readable name shown in the UI — e.g. "Cans", "Blocks", "Pieces". 1–50 characters.',
  })
  @IsString()
  @MinLength(1, { message: 'iceTypeName must not be empty.' })
  @MaxLength(50, { message: 'iceTypeName must not exceed 50 characters.' })
  iceTypeName: string;

  @ApiProperty({
    example: 'Can',
    description:
      'Short system code — letters, digits, dot, underscore, hyphen.  No spaces.  2–50 chars.  ' +
      'Examples: Can, Block, Piece, Can-Large',
  })
  @IsString()
  @Matches(ICE_NAME_REGEX, {
    message:
      'iceTypeCode must be 2–50 characters and may only contain letters, digits, dot (.), underscore (_), or hyphen (-).',
  })
  iceTypeCode: string;

  @ApiProperty({
    example: 'Unit 1',
    description:
      'Factory plant this price applies to (e.g. "Unit 1", "Unit 2", "Unit 3").  ' +
      'Any non-empty string up to 50 characters.',
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
