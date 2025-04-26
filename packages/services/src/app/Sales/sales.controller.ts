import { Controller, Post, Body } from '@nestjs/common';
import { SalesService } from './sales.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleIdRequestDto } from './dto/sale-id-request.dto';

@ApiTags('Sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('createSale')
  @ApiBody({ type: CreateSaleDto })
  async createSale(@Body() reqDto: CreateSaleDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.create(reqDto);
      return new CommonResponse(true, 0, 'Sale Created Successfully', sale);
    } catch (error) {
      return new CommonResponse(false, 1, 'Sale Creation Failed', error);
    }
  }

  @Post('getAllSales')
  @ApiBody({}) // No body required, but included for consistency
  async getAllSales(): Promise<CommonResponse> {
    try {
      const sales = await this.salesService.findAll();
      return new CommonResponse(true, 0, 'Sales Fetched Successfully', sales);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching sales', error);
    }
  }

  @Post('getSaleById')
  @ApiBody({ type: SaleIdRequestDto })
  async getSaleById(@Body() reqDto: SaleIdRequestDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.findOne(+reqDto.saleId);
      return new CommonResponse(true, 0, 'Sale Fetched Successfully', sale);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching sale', error);
    }
  }

  @Post('updateSale')
  @ApiBody({ type: UpdateSaleDto })
  async updateSale(@Body() reqDto: UpdateSaleDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.update(+reqDto.saleId, reqDto);
      return new CommonResponse(true, 0, 'Sale Updated Successfully', sale);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error updating sale', error);
    }
  }

  @Post('deleteSale')
  @ApiBody({ type: SaleIdRequestDto })
  async deleteSale(@Body() reqDto: SaleIdRequestDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.remove(+reqDto.saleId);
      return new CommonResponse(true, 0, 'Sale Deleted Successfully', sale);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error deleting sale', error);
    }
  }

  @Post('getPrintData')
  @ApiBody({ type: SaleIdRequestDto })
  async getPrintData(@Body() reqDto: SaleIdRequestDto): Promise<CommonResponse> {
    try {
      const printData = await this.salesService.getPrintData(+reqDto.saleId);
      return new CommonResponse(true, 0, 'Print Data Fetched Successfully', printData);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching print data', error);
    }
  }
}