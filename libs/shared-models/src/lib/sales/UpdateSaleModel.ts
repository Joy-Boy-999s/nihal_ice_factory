import { Unit } from "../enums/unit-enum";

export class UpdateSaleModel {
    saleId: string;
    date?: string;
    time?: string;
    unit?: Unit;
    name?: string;
    mobile?: string;
    shop?: string;
    cans?: number;
    blocks?: number;
    pieces?: number;
    totalCans?: number;
    discount?: number;
    totalAmount?: number;
    soldBy?: string;
  }
  