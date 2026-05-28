import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import {
  CommonResponse,
  CreatePlantDto,
  UpdatePlantDto,
  AssignPlantAccessDto,
} from '@nihal-ice-factory/shared-models';

export class PlantService extends CommonAxiosService {
  private getUrl(childUrl: string): string {
    return `/plants/${childUrl}`;
  }

  // ── Plant CRUD ──────────────────────────────────────────────────────────────

  async createPlant(
    dto: CreatePlantDto,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(this.getUrl('create'), dto, config);
  }

  async getAllPlants(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl('getAll'), config);
  }

  async getActivePlants(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl('getActive'), config);
  }

  async getPlantById(
    id: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl(`getById/${id}`), config);
  }

  async updatePlant(
    id: number,
    dto: UpdatePlantDto,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPutCall(this.getUrl(`update/${id}`), dto, config);
  }

  async deletePlant(
    id: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosDeleteCall(this.getUrl(`delete/${id}`), config);
  }

  // ── User-Plant Access ────────────────────────────────────────────────────────

  /** Grant a user access to a plant. */
  async assignAccess(
    dto: AssignPlantAccessDto,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosPostCall(this.getUrl('access/assign'), dto, config);
  }

  /** Revoke a user's access to a plant. */
  async revokeAccess(
    userId: string,
    plantId: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosDeleteCall(
      this.getUrl(`access/revoke/${userId}/${plantId}`),
      config,
    );
  }

  /** Get all users who have access to a specific plant. */
  async getUsersForPlant(
    plantId: number,
    config?: AxiosRequestConfig,
  ): Promise<CommonResponse> {
    return this.axiosGetCall(this.getUrl(`access/users/${plantId}`), config);
  }
}
