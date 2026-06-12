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
import { AuditService } from '../Audit/audit.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)       // Every sales endpoint requires a valid JWT
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly auditService: AuditService,
  ) {}

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

  // ── GET /sales/credit-summary ─────────────────────────────────────────────
  // Per-customer outstanding balances (khata) for accessible plants.

  @Get('credit-summary')
  @ApiOperation({ summary: 'Per-customer billed/paid/outstanding summary (khata)' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async getCreditSummary(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.salesService.getCreditSummary(user.userId, user.role === 'ADMIN');
  }

  // ── GET /sales/production-plan ────────────────────────────────────────────
  // Upcoming advance bookings vs current stock for accessible plants.

  @Get('production-plan')
  @ApiOperation({ summary: 'Advance bookings grouped by date/plant/ice type vs current stock' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async getProductionPlan(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.salesService.getProductionPlan(user.userId, user.role === 'ADMIN');
  }

  // ── GET /sales/customer-orders ────────────────────────────────────────────
  // Customer orders for the operator's accessible plants (admins see all).

  @Get('customer-orders')
  @ApiOperation({ summary: 'Customer orders for accessible plants, with payment + fulfillment status' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async getCustomerOrders(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.salesService.getCustomerOrders(user.userId, user.role === 'ADMIN');
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
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    const res = await this.salesService.update(saleId, reqDto);
    if (res.status) this.auditService.log(user, 'SALE_UPDATED', 'sale', saleId);
    return res;
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
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    const res = await this.salesService.deleteOne(saleId);
    if (res.status) this.auditService.log(user, 'SALE_DELETED', 'sale', saleId);
    return res;
  }

  // ── DELETE /sales/deleteSales ────────────────────────────────────────────
  // Admin-only.

  @Delete('deleteSales')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete multiple sales (admin only)' })
  @ApiBody({ type: DeleteSalesDto })
  @HttpCode(HttpStatus.OK)
  async deleteMultiple(
    @Body() reqDto: DeleteSalesDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    const res = await this.salesService.deleteMany(reqDto.ids);
    if (res.status) this.auditService.log(user, 'SALES_DELETED', 'sale', null, `ids=${reqDto.ids.join(',')}`);
    return res;
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
