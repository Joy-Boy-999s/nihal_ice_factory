import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { IceTypeRepository } from './repository/ice-price.repository';
import { CreateIceTypeDto } from './dto/create-ice-price.dto';
import { UpdateIceTypeDto } from './dto/update-ice-price.dto';
import { IceType } from './entities/ice-price.entity';

@Injectable()
export class IceTypeService {
  constructor(private readonly iceTypeRepository: IceTypeRepository) {}

  // ── Public CRUD ──────────────────────────────────────────────────────────

  async createIceType(dto: CreateIceTypeDto): Promise<CommonResponse> {
    try {
      const existing = await this.iceTypeRepository.findOne({
        where: { iceTypeName: dto.iceTypeName, plantUnit: dto.plantUnit },
      });
      if (existing) {
        return new CommonResponse(
          false,
          409,
          `An ice type "${dto.iceTypeName}" at plant "${dto.plantUnit}" already exists`,
          null,
        );
      }

      const entity = this.iceTypeRepository.create({
        iceTypeName: dto.iceTypeName,
        iceTypeCode: dto.iceTypeCode,
        plantUnit:   dto.plantUnit,
        price:       dto.price,
        isActive:    true,
      });
      const saved = await this.iceTypeRepository.save(entity);
      return new CommonResponse(true, 201, 'Ice type created successfully', saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async getAllIceTypes(): Promise<CommonResponse> {
    try {
      const types = await this.iceTypeRepository.find({
        order: { iceTypeName: 'ASC', plantUnit: 'ASC' },
      });
      return new CommonResponse(true, 200, 'Ice types fetched successfully', types);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async getIceTypeById(id: number): Promise<CommonResponse> {
    try {
      const type = await this.findOneOrFail(id);
      return new CommonResponse(true, 200, 'Ice type fetched successfully', type);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      const code = error instanceof NotFoundException ? 404 : 500;
      return new CommonResponse(false, code, message, null);
    }
  }

  async updateIceType(id: number, dto: UpdateIceTypeDto): Promise<CommonResponse> {
    try {
      const type = await this.findOneOrFail(id);

      const newName  = dto.iceTypeName ?? type.iceTypeName;
      const newPlant = dto.plantUnit   ?? type.plantUnit;

      if (newName !== type.iceTypeName || newPlant !== type.plantUnit) {
        const duplicate = await this.iceTypeRepository.findOne({
          where: { iceTypeName: newName, plantUnit: newPlant },
        });
        if (duplicate && duplicate.id !== id) {
          return new CommonResponse(
            false,
            409,
            `An ice type "${newName}" at plant "${newPlant}" already exists`,
            null,
          );
        }
      }

      const updated = this.iceTypeRepository.merge(type, {
        ...(dto.iceTypeName !== undefined && { iceTypeName: dto.iceTypeName }),
        ...(dto.iceTypeCode !== undefined && { iceTypeCode: dto.iceTypeCode }),
        ...(dto.plantUnit   !== undefined && { plantUnit:   dto.plantUnit   }),
        ...(dto.price       !== undefined && { price:       dto.price       }),
        ...(dto.isActive    !== undefined && { isActive:    dto.isActive    }),
      });

      const saved = await this.iceTypeRepository.save(updated);
      return new CommonResponse(true, 200, 'Ice type updated successfully', saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      const code = error instanceof NotFoundException ? 404 : 500;
      return new CommonResponse(false, code, message, null);
    }
  }

  async deleteIceType(id: number): Promise<CommonResponse> {
    try {
      const type = await this.findOneOrFail(id);
      await this.iceTypeRepository.remove(type);
      return new CommonResponse(true, 200, 'Ice type deleted successfully', null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      const code = error instanceof NotFoundException ? 404 : 500;
      return new CommonResponse(false, code, message, null);
    }
  }

  // ── Used by SalesService / CustomerService ──────────────────────────────

  /** Returns all active ice types across all plants, sorted by plant then name. */
  async getActive(): Promise<IceType[]> {
    return this.iceTypeRepository.find({
      where: { isActive: true },
      order: { plantUnit: 'ASC', iceTypeName: 'ASC' },
    });
  }

  /**
   * Returns all active IceType entries for a specific factory plant,
   * sorted by name.  SalesService uses this to price the line items.
   */
  async getActiveByPlant(plantUnit: string): Promise<IceType[]> {
    return this.iceTypeRepository.find({
      where: { isActive: true, plantUnit },
      order: { iceTypeName: 'ASC' },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findOneOrFail(id: number): Promise<IceType> {
    const type = await this.iceTypeRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Ice type with ID ${id} not found`);
    }
    return type;
  }
}
