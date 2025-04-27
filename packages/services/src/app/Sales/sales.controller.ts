import { Controller, Post, Body, Get, Param, ParseIntPipe, Put, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { SalesService } from './sales.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse, DeleteSalesDto } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleUpdateDto} from './dto/update-sale.dto';
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

  @Get('getAllSales')
  @ApiOperation({ summary: 'Get all sales' })
  @ApiResponse({ status: 200, description: 'Sales fetched successfully', type: CommonResponse })
  async getAllSales(): Promise<CommonResponse> {
    try {
      const sales = await this.salesService.getAllSales();
      return new CommonResponse(true, 200, 'Sales fetched successfully', sales);
    } catch (error) {
      return new CommonResponse(false, 500, 'Failed to fetch sales', error);
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


  @Put('updateSale/:saleId')
  @ApiOperation({ summary: 'Update Sale Details' })
  @ApiBody({ type: SaleUpdateDto })
  async updateSale(
    @Param('saleId') saleId: number,
    @Body() reqDto: SaleUpdateDto,
  ): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.update(saleId, reqDto);
      return new CommonResponse(true, 0, 'Sale Updated Successfully', sale);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error updating sale', error);
    }
  }

  @Delete('deleteSale/:saleId')
  @ApiOperation({ summary: 'Delete a single sale' })
  @ApiParam({ name: 'saleId', type: Number, description: 'ID of the sale to delete' })
  @HttpCode(HttpStatus.OK)
  async deleteSale(
    @Param('saleId', ParseIntPipe) saleId: number,
  ): Promise<CommonResponse> {
    try {
      await this.salesService.deleteOne(saleId);
      return new CommonResponse(true, 0, 'Sale Deleted Successfully', null);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error deleting sale', error);
    }
  }

  @Delete('deleteSales')
  @ApiOperation({ summary: 'Delete multiple sales' })
  @ApiBody({ type: DeleteSalesDto })
  @HttpCode(HttpStatus.OK)
  async deleteMultiple(
    @Body() reqDto: DeleteSalesDto,
  ): Promise<CommonResponse> {
    try {
      await this.salesService.deleteMany(reqDto.ids);
      return new CommonResponse(true, 0, 'Sales Deleted Successfully', null);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error deleting sales', error);
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