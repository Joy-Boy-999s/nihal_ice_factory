import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CommonResponse,
  DashboardChartSeriesDto,
  DashboardMetricsDto,
  DashboardStatDto,
  SaleUpdateDto,
} from '@nihal-ice-factory/shared-models';
import { CreateSaleDto, SaleItemInput } from './dto/create-sale.dto';
import { GenericTransactionManager } from '../../database/trasanction-manager';
import { SalesRepository } from './repository/sales.repository';
import { Sale, SaleItemSnapshot } from './entities/sale.entity';
import { IceTypeService } from '../IcePrice/ice-price.service';
import { IceType } from '../IcePrice/entities/ice-price.entity';

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly transactionManager: GenericTransactionManager,
    private readonly iceTypeService: IceTypeService,
  ) {}

  // ── Totals calculation ───────────────────────────────────────────────────

  /**
   * Resolves live prices for each item, builds the snapshot array, and
   * computes `totalUnits` + `totalAmount`.
   *
   * Throws if:
   *  • No active ice types exist for the plant.
   *  • An iceTypeId in the items list does not belong to the plant.
   *  • Every item has quantity 0.
   */
  private async buildSaleItems(
    items: SaleItemInput[],
    discount: number,
    plantUnit: string,
  ): Promise<{ snapshots: SaleItemSnapshot[]; totalUnits: number; totalAmount: number }> {
    const activeTypes = await this.iceTypeService.getActiveByPlant(plantUnit);

    if (activeTypes.length === 0) {
      throw new Error(
        `No active ice types configured for plant "${plantUnit}". ` +
        'Please add entries in the Ice Type Master first.',
      );
    }

    const typeMap = new Map<number, IceType>(activeTypes.map((t) => [t.id, t]));

    const snapshots: SaleItemSnapshot[] = [];
    let totalUnits = 0;
    let subtotalBeforeDiscount = 0;

    for (const item of items) {
      const iceType = typeMap.get(item.iceTypeId);
      if (!iceType) {
        throw new Error(
          `Ice type ID ${item.iceTypeId} is not active for plant "${plantUnit}".`,
        );
      }
      const price    = Number(iceType.price);
      const subtotal = item.quantity * price;

      snapshots.push({
        iceTypeId:   iceType.id,
        iceTypeName: iceType.iceTypeName,
        iceTypeCode: iceType.iceTypeCode,
        quantity:    item.quantity,
        price,
        subtotal,
      });

      totalUnits             += item.quantity;
      subtotalBeforeDiscount += subtotal;
    }

    const nonZeroItems = snapshots.filter((s) => s.quantity > 0);
    if (nonZeroItems.length === 0) {
      throw new Error('At least one item must have a quantity greater than zero.');
    }

    const totalAmount = Math.max(0, subtotalBeforeDiscount - discount);
    return { snapshots, totalUnits, totalAmount };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(createSaleDto: CreateSaleDto): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);

      const { snapshots, totalUnits, totalAmount } = await this.buildSaleItems(
        createSaleDto.items,
        createSaleDto.discount ?? 0,
        createSaleDto.unit,
      );

      const sale = saleRepo.create({
        date:        createSaleDto.date,
        time:        createSaleDto.time,
        unit:        createSaleDto.unit,
        name:        createSaleDto.name,
        mobile:      createSaleDto.mobile,
        shop:        createSaleDto.shop,
        soldBy:      createSaleDto.soldBy,
        discount:    createSaleDto.discount ?? 0,
        items:       snapshots,
        totalUnits,
        totalAmount,
      });

      const savedSale = await saleRepo.save(sale);
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 201, 'Sale created successfully', savedSale);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, message.includes('required') ? 400 : 500, message, null);
    }
  }

  async update(saleId: number, updateSaleDto: SaleUpdateDto): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const sale = await this.salesRepository.findOne({ where: { id: saleId } });
      if (!sale) throw new Error('Sale not found');

      // Only recompute if items or unit changed.
      let updatedItems  = sale.items;
      let updatedUnits  = sale.totalUnits;
      let updatedAmount = sale.totalAmount;

      if (updateSaleDto.items && updateSaleDto.items.length > 0) {
        const plantUnit = updateSaleDto.unit ?? sale.unit;
        const { snapshots, totalUnits, totalAmount } = await this.buildSaleItems(
          updateSaleDto.items,
          updateSaleDto.discount ?? sale.discount ?? 0,
          plantUnit,
        );
        updatedItems  = snapshots;
        updatedUnits  = totalUnits;
        updatedAmount = totalAmount;
      }

      const updatedSale = this.salesRepository.create({
        ...sale,
        ...(updateSaleDto.date    !== undefined && { date:    updateSaleDto.date    }),
        ...(updateSaleDto.time    !== undefined && { time:    updateSaleDto.time    }),
        ...(updateSaleDto.unit    !== undefined && { unit:    updateSaleDto.unit    }),
        ...(updateSaleDto.name    !== undefined && { name:    updateSaleDto.name    }),
        ...(updateSaleDto.mobile  !== undefined && { mobile:  updateSaleDto.mobile  }),
        ...(updateSaleDto.shop    !== undefined && { shop:    updateSaleDto.shop    }),
        ...(updateSaleDto.soldBy  !== undefined && { soldBy:  updateSaleDto.soldBy  }),
        ...(updateSaleDto.discount !== undefined && { discount: updateSaleDto.discount }),
        items:       updatedItems,
        totalUnits:  updatedUnits,
        totalAmount: updatedAmount,
      });

      const savedSale = await this.salesRepository.save(updatedSale);
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Sale updated successfully', savedSale);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, message.includes('required') ? 400 : 500, message, null);
    }
  }

  async getAllSales(): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);
      const sales = await saleRepo.find();
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Sales fetched successfully', sales);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async deleteOne(id: number): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);
      const sale = await saleRepo.findOne({ where: { id } });
      if (!sale) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'Sale not found', null);
      }
      await saleRepo.remove(sale);
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Sale deleted successfully', null);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async deleteMany(ids: number[]): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);
      const sales = await saleRepo.find({ where: ids.map((id) => ({ id })) });
      if (sales.length !== ids.length) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'One or more sales not found', null);
      }
      await saleRepo.remove(sales);
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Sales deleted successfully', null);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  async findOne(id: number): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepository.findOne({ where: { id } });
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);
      return new CommonResponse(true, 200, 'Sale fetched successfully', sale);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(
        false,
        error instanceof NotFoundException ? 404 : 500,
        message,
        null,
      );
    }
  }

  async remove(id: number): Promise<CommonResponse> {
    return this.deleteOne(id);
  }

  // ── Print data ───────────────────────────────────────────────────────────

  /**
   * Returns the sale with its full item breakdown for invoice printing.
   * No live price lookup needed — the snapshot stored in `items` is the source.
   */
  async getPrintData(id: number): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepository.findOne({ where: { id } });
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);

      const printData = {
        ...sale,
        itemBreakdown: sale.items.map((item) => ({
          iceTypeName: item.iceTypeName,
          iceTypeCode: item.iceTypeCode,
          quantity:    item.quantity,
          price:       item.price,
          subtotal:    item.subtotal,
        })),
      };

      return new CommonResponse(true, 200, 'Print data fetched successfully', printData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(
        false,
        error instanceof NotFoundException ? 404 : 500,
        message,
        null,
      );
    }
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  async getDashboardMetrics(): Promise<CommonResponse> {
    try {
      const sales = await this.salesRepository.find();
      const metrics = this.buildDashboardMetrics(sales, new Date());
      return new CommonResponse(true, 200, 'Dashboard metrics fetched successfully', metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  private buildDashboardMetrics(sales: Sale[], now: Date): DashboardMetricsDto {
    return {
      generatedAt: now.toISOString(),
      currency: 'INR',
      stats:  this.buildDashboardStats(sales, now),
      charts: this.buildDashboardCharts(sales, now),
    };
  }

  private parseSaleDate(raw: string): Date {
    return new Date(`${raw}T00:00:00`);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth()    &&
      a.getDate()     === b.getDate()
    );
  }

  private isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  private getWeekStart(d: Date): Date {
    const start = new Date(d);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private formatRupees(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private growthText(current: number, previous: number): string {
    if (previous <= 0) {
      return current > 0 ? 'New growth from last month' : 'No change vs last month';
    }
    const percent = ((current - previous) / previous) * 100;
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}% vs last month`;
  }

  private buildDashboardStats(sales: Sale[], now: Date): DashboardStatDto[] {
    const weekStart = this.getWeekStart(now);

    const todaySales = sales.filter((s) => this.isSameDay(this.parseSaleDate(s.date), now));
    const weekSales  = sales.filter((s) => {
      const d = this.parseSaleDate(s.date);
      return d >= weekStart && d <= now;
    });
    const monthSales = sales.filter((s) => this.isSameMonth(this.parseSaleDate(s.date), now));

    const prevMonthRef   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthSales = sales.filter((s) =>
      this.isSameMonth(this.parseSaleDate(s.date), prevMonthRef),
    );

    const sumAmount = (rows: Sale[]): number =>
      rows.reduce((total, row) => total + Number(row.totalAmount || 0), 0);

    const todayTotal    = sumAmount(todaySales);
    const weekTotal     = sumAmount(weekSales);
    const monthTotal    = sumAmount(monthSales);
    const prevMonthTotal = sumAmount(prevMonthSales);

    const uniqueCustomers = new Set(
      sales.map((s) => s.mobile?.trim() || `${s.name || 'anon'}-${s.id}`),
    ).size;

    return [
      {
        key: 'today',
        label: 'Sales Today',
        value: todayTotal,
        formatted: this.formatRupees(todayTotal),
        delta: `${todaySales.length} orders today`,
        tone: 'primary',
      },
      {
        key: 'week',
        label: 'Sales This Week',
        value: weekTotal,
        formatted: this.formatRupees(weekTotal),
        delta: `${weekSales.length} orders this week`,
        tone: 'success',
      },
      {
        key: 'month',
        label: 'Sales This Month',
        value: monthTotal,
        formatted: this.formatRupees(monthTotal),
        delta: this.growthText(monthTotal, prevMonthTotal),
        tone: 'success',
      },
      {
        key: 'customers',
        label: 'Unique Customers',
        value: uniqueCustomers,
        formatted: uniqueCustomers.toLocaleString('en-IN'),
        delta: `${sales.length} total sales records`,
        tone: 'warning',
      },
    ];
  }

  private buildDashboardCharts(sales: Sale[], now: Date): DashboardChartSeriesDto[] {
    const monthDays  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthSeries = new Array<number>(monthDays).fill(0);
    const weekSeries  = new Array<number>(7).fill(0);
    const yearSeries  = new Array<number>(12).fill(0);
    const weekStart   = this.getWeekStart(now);

    for (const sale of sales) {
      const d      = this.parseSaleDate(sale.date);
      const amount = Number(sale.totalAmount || 0);

      if (d.getFullYear() === now.getFullYear()) {
        yearSeries[d.getMonth()] += amount;
      }
      if (this.isSameMonth(d, now)) {
        monthSeries[d.getDate() - 1] += amount;
      }
      const dayDiff = Math.floor((d.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff >= 0 && dayDiff < 7) {
        weekSeries[dayDiff] += amount;
      }
    }

    const monthLabels = Array.from({ length: monthDays }, (_, i) => `${i + 1}`);
    const yearLabels  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weekLabels  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    return [
      { key: 'month', title: "This Month's Sales", kind: 'bar',  labels: monthLabels, values: monthSeries, accent: '#0ea5e9' },
      { key: 'year',  title: "This Year's Sales",  kind: 'line', labels: yearLabels,  values: yearSeries,  accent: '#10b981' },
      { key: 'week',  title: "This Week's Sales",  kind: 'bar',  labels: weekLabels,  values: weekSeries,  accent: '#f97316' },
    ];
  }
}
