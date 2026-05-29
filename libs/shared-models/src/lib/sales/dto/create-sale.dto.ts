import { IsString, IsNumber, IsDateString, Min, IsOptional, IsArray } from 'class-validator';

/** A single line item sent by the client when creating/updating a sale. */
export class SaleItemInput {
  /** ID of the IceType entry from the master. */
  @IsNumber()
  @Min(1)
  iceTypeId: number;

  /** Quantity of this ice type sold. */
  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsString()
  time: string;

  /** Factory plant / unit (e.g. "Unit 1"). */
  @IsString()
  unit: string;

  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsString()
  shop: string;

  /** At least one item with quantity > 0 required. */
  @IsArray()
  items: SaleItemInput[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsString()
  soldBy: string;
}
