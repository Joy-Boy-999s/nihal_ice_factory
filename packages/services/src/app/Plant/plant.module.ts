import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Plant } from './entities/plant.entity';
import { UserPlantAccess } from './entities/user-plant-access.entity';
import { PlantController } from './plant.controller';
import { PlantService } from './plant.service';
import { PlantRepository } from './repository/plant.repository';
import { UserPlantAccessRepository } from './repository/user-plant-access.repository';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Plant, UserPlantAccess]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [PlantController],
  providers: [PlantService, PlantRepository, UserPlantAccessRepository],
  exports: [PlantService],
})
export class PlantModule {}
