import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable, from, interval, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { SalesService } from './sales.service';
import { CommonResponse, DeleteSalesDto } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleUpdateDto } from './dto/update-sale.dto';
import { SaleIdRequestDto } from './dto/sale-id-request.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)       // Every sales endpoint requires a valid JWT
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ── POST /sales/createSale ────────────────────────────────────────────────
  // Non-admin: only for plants they are assigned to (enforced in service).

  @Post('createSale')
  @ApiBody({ type: CreateSaleDto })
  @ApiOperation({ summary: 'Create a sale (must be assigned to the target plant)' })
  async createSale(
    @Body() reqDto: CreateSaleDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.salesService.create(reqDto, user.userId, user.role === 'ADMIN');
  }

  // ── GET /sales/getAllSales ────────────────────────────────────────────────
  // ADMIN → all sales | USER → only sales from assigned plants (DB-filtered).

  @Get('getAllSales')
  @ApiOperation({ summary: 'Get sales (scoped to accessible plants for non-admins)' })
  @ApiResponse({ status: 200, description: 'Sales fetched successfully', type: CommonResponse })
  async getAllSales(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.salesService.getAllSales(user.userId, user.role === 'ADMIN');
  }

  // ── GET /sales/getDashboardMetrics ────────────────────────────────────────
  // Admin-only.

  @Get('getDashboardMetrics')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get aggregated dashboard metrics (admin only)' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async getDashboardMetrics(): Promise<CommonResponse> {
    return this.salesService.getDashboardMetrics();
  }

  // ── SSE /sales/dashboardMetrics/stream ────────────────────────────────────
  // Admin-only.

  @Sse('dashboardMetrics/stream')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'SSE stream for live dashboard metrics (admin only)' })
  streamDashboardMetrics(): Observable<MessageEvent> {
    const metrics$ = interval(15000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.salesService.getDashboardMetrics()).pipe(
          map(
            (response: CommonResponse): MessageEvent => ({
              type:  'metrics',
              retry: 1000,
              data:  response,
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

  // ── POST /sales/getSaleById ───────────────────────────────────────────────
  // Non-admin: only if they are assigned to the sale's plant.

  @Post('getSaleById')
  @ApiBody({ type: SaleIdRequestDto })
  @ApiOperation({ summary: 'Get a sale by ID (must be assigned to its plant)' })
  async getSaleById(
    @Body() reqDto: SaleIdRequestDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.salesService.findOne(+reqDto.saleId, user.userId, user.role === 'ADMIN');
  }

  // ── PUT /sales/updateSale/:saleId ────────────────────────────────────────
  // Admin-only.

  @Put('updateSale/:saleId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a sale (admin only)' })
  @ApiBody({ type: SaleUpdateDto })
  async updateSale(
    @Param('saleId') saleId: number,
    @Body() reqDto: SaleUpdateDto,
  ): Promise<CommonResponse> {
    return this.salesService.update(saleId, reqDto);
  }

  // ── DELETE /sales/deleteSale/:saleId ────────────────────────────────────
  // Admin-only.

  @Delete('deleteSale/:saleId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a single sale (admin only)' })
  @ApiParam({ name: 'saleId', type: Number })
  @HttpCode(HttpStatus.OK)
  async deleteSale(
    @Param('saleId', ParseIntPipe) saleId: number,
  ): Promise<CommonResponse> {
    return this.salesService.deleteOne(saleId);
  }

  // ── DELETE /sales/deleteSales ────────────────────────────────────────────
  // Admin-only.

  @Delete('deleteSales')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete multiple sales (admin only)' })
  @ApiBody({ type: DeleteSalesDto })
  @HttpCode(HttpStatus.OK)
  async deleteMultiple(@Body() reqDto: DeleteSalesDto): Promise<CommonResponse> {
    return this.salesService.deleteMany(reqDto.ids);
  }

  // ── POST /sales/getPrintData ─────────────────────────────────────────────
  // Non-admin: only if they are assigned to the sale's plant.

  @Post('getPrintData')
  @ApiBody({ type: SaleIdRequestDto })
  @ApiOperation({ summary: 'Get print data for a sale (must be assigned to its plant)' })
  async getPrintData(
    @Body() reqDto: SaleIdRequestDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.salesService.getPrintData(+reqDto.saleId, user.userId, user.role === 'ADMIN');
  }
}
