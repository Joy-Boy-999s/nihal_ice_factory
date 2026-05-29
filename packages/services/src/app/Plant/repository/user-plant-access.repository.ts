import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserPlantAccess } from '../entities/user-plant-access.entity';

@Injectable()
export class UserPlantAccessRepository extends Repository<UserPlantAccess> {
  constructor(dataSource: DataSource) {
    super(UserPlantAccess, dataSource.createEntityManager());
  }
}
