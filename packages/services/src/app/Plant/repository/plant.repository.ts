import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Plant } from '../entities/plant.entity';

@Injectable()
export class PlantRepository extends Repository<Plant> {
  constructor(dataSource: DataSource) {
    super(Plant, dataSource.createEntityManager());
  }
}
