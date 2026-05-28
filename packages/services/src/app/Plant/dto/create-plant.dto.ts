import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePlantDto {
  @ApiProperty({
    example: 'Unit 1',
    description: 'Plant / unit name — 1 to 100 characters.',
  })
  @IsString()
  @MinLength(1, { message: 'plantName must not be empty.' })
  @MaxLength(100, { message: 'plantName must not exceed 100 characters.' })
  plantName: string;
}
