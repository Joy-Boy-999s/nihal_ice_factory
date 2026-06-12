import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Plant } from './entities/plant.entity';
import { UserPlantAccess } from './entities/user-plant-access.entity';
import { PlantRepository } from './repository/plant.repository';
import { UserPlantAccessRepository } from './repository/user-plant-access.repository';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { AssignPlantAccessDto } from './dto/assign-plant-access.dto';
import { Sale } from '../Sales/entities/sale.entity';
import { IceBatch } from '../Inventory/entities/ice-batch.entity';
import { IceSlot } from '../Inventory/entities/ice-slot.entity';
import { IceType } from '../IcePrice/entities/ice-price.entity';

@Injectable()
export class PlantService {
  private readonly logger = new Logger(PlantService.name);

  constructor(
    private readonly plantRepository: PlantRepository,
    private readonly accessRepository: UserPlantAccessRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(dto: CreatePlantDto): Promise<Plant> {
    const existing = await this.plantRepository.findOne({
      where: { plantName: dto.plantName },
    });
    if (existing) {
      throw new ConflictException(`A plant named "${dto.plantName}" already exists.`);
    }
    const plant = this.plantRepository.create({ plantName: dto.plantName });
    return this.plantRepository.save(plant);
  }

  async getAll(): Promise<Plant[]> {
    return this.plantRepository.find({ order: { plantName: 'ASC' } });
  }

  async getAllActive(): Promise<Plant[]> {
    return this.plantRepository.find({
      where: { isActive: true },
      order: { plantName: 'ASC' },
    });
  }

  async getById(id: number): Promise<Plant> {
    const plant = await this.plantRepository.findOne({ where: { id } });
    if (!plant) throw new NotFoundException(`Plant #${id} not found.`);
    return plant;
  }

  async update(id: number, dto: UpdatePlantDto): Promise<Plant> {
    const plant = await this.getById(id);
    const oldName = plant.plantName;
    const renamingTo =
      dto.plantName !== undefined && dto.plantName !== oldName ? dto.plantName : null;

    if (renamingTo) {
      const conflict = await this.plantRepository.findOne({
        where: { plantName: renamingTo },
      });
      if (conflict) {
        throw new ConflictException(`A plant named "${renamingTo}" already exists.`);
      }
      plant.plantName = renamingTo;
    }

    if (dto.isActive !== undefined) {
      plant.isActive = dto.isActive;
    }

    if (!renamingTo) {
      return this.plantRepository.save(plant);
    }

    // Plants are referenced BY NAME across sales, batches, slots and prices
    // (denormalized snapshots). A rename must cascade to all of them in one
    // transaction, or every historical record and stock lookup silently
    // detaches from the plant.
    return this.dataSource.transaction(async (em) => {
      const saved = await em.save(Plant, plant);
      const [sales, batches, slots, prices] = await Promise.all([
        em.update(Sale,     { unit: oldName },      { unit: renamingTo }),
        em.update(IceBatch, { plantUnit: oldName }, { plantUnit: renamingTo }),
        em.update(IceSlot,  { plantUnit: oldName }, { plantUnit: renamingTo }),
        em.update(IceType,  { plantUnit: oldName }, { plantUnit: renamingTo }),
      ]);
      this.logger.log(
        `Plant "${oldName}" renamed to "${renamingTo}" — cascaded to ` +
          `${sales.affected ?? 0} sales, ${batches.affected ?? 0} batches, ` +
          `${slots.affected ?? 0} slots, ${prices.affected ?? 0} ice types`,
      );
      return saved;
    });
  }

  async delete(id: number): Promise<void> {
    const plant = await this.getById(id);
    // Remove all access records for this plant first.
    await this.accessRepository.delete({ plantId: id });
    await this.plantRepository.remove(plant);
  }

  // ── Access management ──────────────────────────────────────────────────────

  /**
   * Grant a user access to a plant.
   * Idempotent — if the mapping already exists it is returned as-is.
   */
  async assignAccess(dto: AssignPlantAccessDto): Promise<UserPlantAccess> {
    // Verify plant exists.
    await this.getById(dto.plantId);

    const existing = await this.accessRepository.findOne({
      where: { userId: dto.userId, plantId: dto.plantId },
    });
    if (existing) return existing;

    const access = this.accessRepository.create({
      userId:  dto.userId,
      plantId: dto.plantId,
    });
    return this.accessRepository.save(access);
  }

  /**
   * Revoke a user's access to a plant.
   * Silently succeeds if the mapping does not exist.
   */
  async revokeAccess(userId: string, plantId: number): Promise<void> {
    const access = await this.accessRepository.findOne({
      where: { userId, plantId },
    });
    if (access) await this.accessRepository.remove(access);
  }

  /**
   * Return all access records for a given plant.
   * The controller / frontend resolves user names from the users list.
   */
  async getUsersForPlant(plantId: number): Promise<UserPlantAccess[]> {
    return this.accessRepository.find({
      where: { plantId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Return the plant IDs a specific user has been granted access to.
   */
  async getPlantIdsForUser(userId: string): Promise<number[]> {
    const rows = await this.accessRepository.find({ where: { userId } });
    return rows.map((r) => r.plantId);
  }

  /**
   * Role-aware plant list for dropdowns.
   * ADMIN  → all active plants.
   * Others → only active plants the user has been granted access to.
   */
  async getAccessible(userId: string, isAdmin: boolean): Promise<Plant[]> {
    if (isAdmin) {
      return this.plantRepository.find({
        where: { isActive: true },
        order: { plantName: 'ASC' },
      });
    }

    const plantIds = await this.getPlantIdsForUser(userId);
    if (plantIds.length === 0) return [];

    return this.plantRepository
      .createQueryBuilder('plant')
      .where('plant.id IN (:...ids)', { ids: plantIds })
      .andWhere('plant.isActive = :isActive', { isActive: true })
      .orderBy('plant.plantName', 'ASC')
      .getMany();
  }
}
