import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IceType } from '../entities/ice-price.entity';

@Injectable()
export class IceTypeRepository extends Repository<IceType> {
  constructor(dataSource: DataSource) {
    super(IceType, dataSource.createEntityManager());
  }
}
