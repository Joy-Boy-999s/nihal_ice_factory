import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse, DeleteSalesDto } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleUpdateDto} from './dto/update-sale.dto';
import { SaleIdRequestDto } from './dto/sale-id-request.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { Observable, from, interval, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

interface JwtUser {
  userId: string;
  username: string;
  role: string;
}

interface AuthenticatedRequest {
  user: JwtUser;
}

@ApiTags('Sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  private ensureAdmin(user: JwtUser): void {
    if (String(user?.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Dashboard metrics are available only for admin users');
    }
  }

  @Post('createSale')
  @ApiBody({ type: CreateSaleDto })
  async createSale(@Body() reqDto: CreateSaleDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.create(reqDto);
      return new CommonResponse(true, 0, 'Sale Created Successfully', sale);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sale Creation Failed';
      return new CommonResponse(false, 1, msg, null);
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
      const msg = error instanceof Error ? error.message : 'Failed to fetch sales';
      return new CommonResponse(false, 500, msg, null);
    }
  }

  @Get('getDashboardMetrics')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get aggregated dashboard metrics (stats + chart series)' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics fetched successfully', type: CommonResponse })
  async getDashboardMetrics(@Req() req: AuthenticatedRequest): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.salesService.getDashboardMetrics();
  }

  @Sse('dashboardMetrics/stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'SSE stream for live dashboard metrics (admin only)' })
  streamDashboardMetrics(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    this.ensureAdmin(req.user);

    const metrics$ = interval(15000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.salesService.getDashboardMetrics()).pipe(
          map(
            (response: CommonResponse): MessageEvent => ({
              type: 'metrics',
              retry: 1000,
              data: response,
            }),
          ),
          catchError((error: Error) => {
            const message = error instanceof Error ? error.message : 'Dashboard SSE error';
            return of<MessageEvent>({
              type: 'metrics-error',
              data: new CommonResponse(false, 500, message, null),
            });
          }),
        ),
      ),
    );

    const heartbeat$ = interval(5000).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { ts: new Date().toISOString() },
        }),
      ),
    );

    return merge(metrics$, heartbeat$);
  }

  @Post('getSaleById')
  @ApiBody({ type: SaleIdRequestDto })
  async getSaleById(@Body() reqDto: SaleIdRequestDto): Promise<CommonResponse> {
    try {
      const sale = await this.salesService.findOne(+reqDto.saleId);
      return new CommonResponse(true, 0, 'Sale Fetched Successfully', sale);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error fetching sale';
      return new CommonResponse(false, 1, msg, null);
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
      const msg = error instanceof Error ? error.message : 'Error updating sale';
      return new CommonResponse(false, 1, msg, null);
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
      const msg = error instanceof Error ? error.message : 'Error deleting sale';
      return new CommonResponse(false, 1, msg, null);
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
      const msg = error instanceof Error ? error.message : 'Error deleting sales';
      return new CommonResponse(false, 1, msg, null);
    }
  }

  @Post('getPrintData')
  @ApiBody({ type: SaleIdRequestDto })
  async getPrintData(@Body() reqDto: SaleIdRequestDto): Promise<CommonResponse> {
    try {
      const printData = await this.salesService.getPrintData(+reqDto.saleId);
      return new CommonResponse(true, 0, 'Print Data Fetched Successfully', printData);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error fetching print data';
      return new CommonResponse(false, 1, msg, null);
    }
  }
}