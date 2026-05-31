import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IceSizeConversion } from '../entities/ice-size-conversion.entity';

@Injectable()
export class IceSizeConversionRepository extends Repository<IceSizeConversion> {
  constructor(dataSource: DataSource) {
    super(IceSizeConversion, dataSource.createEntityManager());
  }
}
