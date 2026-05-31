/** One pairwise size conversion returned by the API. */
export interface IceSizeConversionDto {
  id:           number;
  fromTypeName: string;
  toTypeName:   string;
  /** 1 fromTypeName = factor toTypeName */
  factor:       number;
  createdAt:    string;
  updatedAt:    string;
}

/** One entry in the save-all request body. */
export interface ConversionInputDto {
  fromTypeName: string;
  toTypeName:   string;
  factor:       number;
}
