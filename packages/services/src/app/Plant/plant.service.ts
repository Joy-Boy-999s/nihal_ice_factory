import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Plant } from './entities/plant.entity';
import { UserPlantAccess } from './entities/user-plant-access.entity';
import { PlantRepository } from './repository/plant.repository';
import { UserPlantAccessRepository } from './repository/user-plant-access.repository';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { AssignPlantAccessDto } from './dto/assign-plant-access.dto';

@Injectable()
export class PlantService {
  constructor(
    private readonly plantRepository: PlantRepository,
    private readonly accessRepository: UserPlantAccessRepository,
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

    if (dto.plantName !== undefined && dto.plantName !== plant.plantName) {
      const conflict = await this.plantRepository.findOne({
        where: { plantName: dto.plantName },
      });
      if (conflict) {
        throw new ConflictException(`A plant named "${dto.plantName}" already exists.`);
      }
      plant.plantName = dto.plantName;
    }

    if (dto.isActive !== undefined) {
      plant.isActive = dto.isActive;
    }

    return this.plantRepository.save(plant);
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
