import { JwtModule } from '@nestjs/jwt';
import { AppService } from './app.service';
import { DatabaseModule } from '../database/database.module';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    DatabaseModule,
    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}