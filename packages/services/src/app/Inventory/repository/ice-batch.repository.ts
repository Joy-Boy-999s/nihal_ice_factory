import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IceBatch } from '../entities/ice-batch.entity';

@Injectable()
export class IceBatchRepository extends Repository<IceBatch> {
  constructor(private readonly dataSource: DataSource) {
    super(IceBatch, dataSource.createEntityManager());
  }
}
