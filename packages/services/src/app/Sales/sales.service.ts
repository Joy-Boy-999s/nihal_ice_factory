import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CommonResponse,
  DashboardChartSeriesDto,
  DashboardMetricsDto,
  DashboardStatDto,
  SaleUpdateDto,
} from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { GenericTransactionManager } from '../../database/trasanction-manager';
import { SalesRepository } from './repository/sales.repository';
import { Sale } from './entities/sale.entity';

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly transactionManager: GenericTransactionManager,
  ) {}

  private calculateTotalAmount(cans: number, blocks: number, pieces: number, discount = 0): number {
    const pricePerCan = 240;
    const pricePerBlock = 80;
    const pricePerPiece = 20;
    const total = cans * pricePerCan + blocks * pricePerBlock + pieces * pricePerPiece;
    return total - discount;
  }

  private calculateTotalCans(cans: number, blocks: number, pieces: number): number {
    return cans + blocks / 3 + pieces / 12;
  }

  async create(createSaleDto: CreateSaleDto): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);

      const totalAmount = this.calculateTotalAmount(
        createSaleDto.cans,
        createSaleDto.blocks,
        createSaleDto.pieces,
      );
      const totalCans = this.calculateTotalCans(
        createSaleDto.cans,
        createSaleDto.blocks,
        createSaleDto.pieces,
      );

      const sale = saleRepo.create({
        ...createSaleDto,
        totalAmount,
        totalCans,
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
      // Use salesRepository directly here
      const sale = await this.salesRepository.findOne({ where: { id: saleId } });

      if (!sale) {
        throw new Error('Sale not found');
      }

      const totalAmount = this.calculateTotalAmount(
        updateSaleDto.cans || sale.cans,
        updateSaleDto.blocks || sale.blocks,
        updateSaleDto.pieces || sale.pieces,
      );
      const totalCans = this.calculateTotalCans(
        updateSaleDto.cans || sale.cans,
        updateSaleDto.blocks || sale.blocks,
        updateSaleDto.pieces || sale.pieces,
      );

      const updatedSale = this.salesRepository.create({
        ...sale,
        ...updateSaleDto,
        totalAmount,
        totalCans,
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

  /**
   * Delete multiple sales by IDs
   */
  async deleteMany(ids: number[]): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);
      const sales = await saleRepo.find({ where: ids.map(id => ({ id })) });
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
      if (!sale) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }
      return new CommonResponse(true, 200, 'Sale fetched successfully', sale);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, error instanceof NotFoundException ? 404 : 500, message, null);
    }
  }

  

  async remove(id: number): Promise<CommonResponse> {
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
    const stats = this.buildDashboardStats(sales, now);
    const charts = this.buildDashboardCharts(sales, now);
    return {
      generatedAt: now.toISOString(),
      currency: 'INR',
      stats,
      charts,
    };
  }

  private parseSaleDate(raw: string): Date {
    return new Date(`${raw}T00:00:00`);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
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
    const weekSales = sales.filter((s) => {
      const d = this.parseSaleDate(s.date);
      return d >= weekStart && d <= now;
    });
    const monthSales = sales.filter((s) => this.isSameMonth(this.parseSaleDate(s.date), now));

    const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthSales = sales.filter((s) =>
      this.isSameMonth(this.parseSaleDate(s.date), prevMonthRef),
    );

    const sumAmount = (rows: Sale[]): number =>
      rows.reduce((total, row) => total + Number(row.totalAmount || 0), 0);

    const todayTotal = sumAmount(todaySales);
    const weekTotal = sumAmount(weekSales);
    const monthTotal = sumAmount(monthSales);
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
    const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthSeries = new Array<number>(monthDays).fill(0);

    const weekStart = this.getWeekStart(now);
    const weekSeries = new Array<number>(7).fill(0);
    const yearSeries = new Array<number>(12).fill(0);

    for (const sale of sales) {
      const d = this.parseSaleDate(sale.date);
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

    const monthLabels = Array.from({ length: monthDays }, (_, idx) => `${idx + 1}`);
    const yearLabels = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return [
      {
        key: 'month',
        title: "This Month's Sales",
        kind: 'bar',
        labels: monthLabels,
        values: monthSeries,
        accent: '#0ea5e9',
      },
      {
        key: 'year',
        title: "This Year's Sales",
        kind: 'line',
        labels: yearLabels,
        values: yearSeries,
        accent: '#10b981',
      },
      {
        key: 'week',
        title: "This Week's Sales",
        kind: 'bar',
        labels: weekLabels,
        values: weekSeries,
        accent: '#f97316',
      },
    ];
  }

  async getPrintData(id: number): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepository.findOne({ where: { id } });
      if (!sale) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }

      const totalCans = this.calculateTotalCans(sale.cans, sale.blocks, sale.pieces);

      const printData = {
        ...sale,
        totalCans: totalCans.toFixed(2),
        canCost: sale.cans * 240,
        blockCost: sale.blocks * 80,
        pieceCost: sale.pieces * 20,
      };

      return new CommonResponse(true, 200, 'Print data fetched successfully', printData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, error instanceof NotFoundException ? 404 : 500, message, null);
    }
  }
}
