import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { UserEntity } from '../user/entities/user.entity';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { CustomerModule } from '../Customer/customer.module';
import { IceTypeModule } from '../IcePrice/ice-price.module';
import { PlantModule } from '../Plant/plant.module';
import { NotificationModule } from '../Notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity]),
    CustomerModule,
    IceTypeModule,
    PlantModule,
    NotificationModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, SalesRepository],
})
export class WhatsappModule {}
