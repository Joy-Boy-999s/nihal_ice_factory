import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IceSizeConversion } from './entities/ice-size-conversion.entity';
import { IceSizeConversionController } from './ice-size-conversion.controller';
import { IceSizeConversionService } from './ice-size-conversion.service';
import { IceSizeConversionRepository } from './repository/ice-size-conversion.repository';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([IceSizeConversion]),
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
  controllers: [IceSizeConversionController],
  providers: [IceSizeConversionService, IceSizeConversionRepository],
  exports: [IceSizeConversionService],
})
export class IceSizeConversionModule {}
