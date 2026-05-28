/**
 * Shared DTOs for the Plant Master and User-Plant Access.
 * Used by both the NestJS backend (type reference) and the React frontend.
 */

// ── Plant ────────────────────────────────────────────────────────────────────

export class PlantDto {
  id!: number;
  plantName!: string;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class CreatePlantDto {
  plantName!: string;
}

export class UpdatePlantDto {
  plantName?: string;
  isActive?: boolean;
}

// ── User-Plant Access ─────────────────────────────────────────────────────────

/** A single access record — which user has access to which plant. */
export class UserPlantAccessDto {
  id!: number;
  userId!: string;
  plantId!: number;
  createdAt!: string;
}

/** Payload to grant or check plant access. */
export class AssignPlantAccessDto {
  userId!: string;
  plantId!: number;
}

// ── User summary (returned by GET /users/getAll) ─────────────────────────────

export class UserSummaryDto {
  id!: string;
  username!: string;
  email!: string;
  role!: string;
}
