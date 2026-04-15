import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Sale } from '../entities/sale.entity';

@Injectable()
export class SalesRepository extends Repository<Sale> {
  constructor(dataSource: DataSource) {
    super(Sale, dataSource.createEntityManager());
  }
}