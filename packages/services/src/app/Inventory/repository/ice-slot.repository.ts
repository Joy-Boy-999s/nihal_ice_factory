import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IceSlot } from '../entities/ice-slot.entity';

@Injectable()
export class IceSlotRepository extends Repository<IceSlot> {
  constructor(private readonly dataSource: DataSource) {
    super(IceSlot, dataSource.createEntityManager());
  }
}
