// src/app/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule }   from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AppService }  from './app.service';
import { AppController } from './app.controller';
import { UserModule }  from './user/user.module';
import { SalesModule } from './Sales/sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',  // adjust if your .env lives elsewhere
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: '7d' },
    }),
    DatabaseModule,
    UserModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
