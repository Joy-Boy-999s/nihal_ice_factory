import { Injectable } from '@nestjs/common';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { IceSizeConversionRepository } from './repository/ice-size-conversion.repository';

export interface ConversionInput {
  fromTypeName: string;
  toTypeName:   string;
  factor:       number;
}

@Injectable()
export class IceSizeConversionService {
  constructor(private readonly repo: IceSizeConversionRepository) {}

  async getAll(): Promise<CommonResponse> {
    try {
      const rows = await this.repo.find({ order: { fromTypeName: 'ASC', toTypeName: 'ASC' } });
      return new CommonResponse(true, 200, 'Conversions fetched successfully', rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Replaces ALL existing conversions with the provided list.
   * Sending an empty array clears all conversions.
   */
  async saveAll(conversions: ConversionInput[]): Promise<CommonResponse> {
    try {
      await this.repo.clear();
      if (conversions.length > 0) {
        const entities = conversions.map(c =>
          this.repo.create({
            fromTypeName: c.fromTypeName,
            toTypeName:   c.toTypeName,
            factor:       c.factor,
          }),
        );
        await this.repo.save(entities);
      }
      return new CommonResponse(true, 200, 'Conversions saved successfully', null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new CommonResponse(false, 500, message, null);
    }
  }
}
