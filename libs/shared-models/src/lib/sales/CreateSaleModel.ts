import { Unit } from "../enums/unit-enum";

export class CreateSaleModel {
    date: string; // e.g., "2025-04-26"
    time: string; // e.g., "10:00"
    unit: Unit;
    name: string;
    mobile: string;
    shop: string;
    cans: number;
    blocks: number;
    pieces: number;
    totalCans: number;
    discount?: number;
    totalAmount: number;
    soldBy: string;
  }