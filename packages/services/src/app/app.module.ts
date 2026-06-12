import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { UserModule } from './user/user.module';
import { SalesModule } from './Sales/sales.module';
import { IceTypeModule } from './IcePrice/ice-price.module';
import { PlantModule } from './Plant/plant.module';
import { IceSizeConversionModule } from './IceSizeConversion/ice-size-conversion.module';
import { PaymentModule } from './Payment/payment.module';
import { CustomerModule } from './Customer/customer.module';
import { CustomerDiscountModule } from './CustomerDiscount/customer-discount.module';
import { InventoryModule } from './Inventory/inventory.module';
import { NotificationModule } from './Notification/notification.module';
import { WhatsappModule } from './Whatsapp/whatsapp.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Only load .env in development, let Render handle env vars in production
      envFilePath: process.env.NODE_ENV === 'development' ? '../../.env' : undefined,
    }),
    // Global rate limiting — generous default; auth endpoints carry stricter
    // per-route @Throttle limits (brute-force protection).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
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
    PaymentModule,
    CustomerModule,
    CustomerDiscountModule,
    InventoryModule,
    NotificationModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
