import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class AssignPlantAccessDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'UUID of the user to grant access.' })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiProperty({ example: 1, description: 'ID of the plant to grant access to.' })
  @IsNumber()
  @Min(1)
  plantId: number;
}
