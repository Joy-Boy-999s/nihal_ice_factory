import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { UserModule } from './user/user.module';
import { SalesModule } from './Sales/sales.module';
import { IceTypeModule } from './IcePrice/ice-price.module';
import { PlantModule } from './Plant/plant.module';
import { IceSizeConversionModule } from './IceSizeConversion/ice-size-conversion.module';
import { InventoryModule } from './Inventory/inventory.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Only load .env in development, let Render handle env vars in production
      envFilePath: process.env.NODE_ENV === 'development' ? '../../.env' : undefined,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    DatabaseModule,
    UserModule,
    SalesModule,
    IceTypeModule,
    PlantModule,
    IceSizeConversionModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}