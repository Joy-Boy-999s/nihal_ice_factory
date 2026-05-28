/** One line item in the dynamic sale form (mirrors the IceType master entry). */
export interface SaleItem {
  iceTypeId:   number;
  iceTypeName: string;
  iceTypeCode: string;
  price:       number;
  /** String so it can be bound directly to an <input value> */
  quantity: string;
}

export interface SaleForm {
  date:     string;
  time:     string;
  /** Factory plant selected for this sale. */
  unit:     string;
  name:     string;
  mobile:   string;
  shop:     string;
  /** Dynamically populated from the Ice Type Master when a plant is selected. */
  items:    SaleItem[];
  discount: string;
  soldBy:   string;
}
