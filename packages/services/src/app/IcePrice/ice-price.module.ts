import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IceType } from './entities/ice-price.entity';
import { IceTypeController } from './ice-price.controller';
import { IceTypeService } from './ice-price.service';
import { IceTypeRepository } from './repository/ice-price.repository';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([IceType]),
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
  controllers: [IceTypeController],
  providers: [IceTypeService, IceTypeRepository],
  exports: [IceTypeService],
})
export class IceTypeModule {}
