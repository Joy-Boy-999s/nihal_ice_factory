import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
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
import { PlantService } from '../Plant/plant.service';
import { IceBatchRepository } from '../Inventory/repository/ice-batch.repository';
import { IceSlotRepository } from '../Inventory/repository/ice-slot.repository';
import { IceBatch } from '../Inventory/entities/ice-batch.entity';
import { IceSlot } from '../Inventory/entities/ice-slot.entity';
import { Payment } from '../Payment/entities/payment.entity';

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly transactionManager: GenericTransactionManager,
    private readonly iceTypeService: IceTypeService,
    private readonly plantService: PlantService,
    private readonly batchRepo: IceBatchRepository,
    private readonly slotRepo: IceSlotRepository,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
  ) {}

  // ── Plant-access helpers ─────────────────────────────────────────────────

  /**
   * Returns plant names the user has been assigned to.
   * Always returns the full list for ADMIN (pass isAdmin=true to skip the DB lookup).
   */
  private async getAccessiblePlantNames(userId: string): Promise<string[]> {
    const plants = await this.plantService.getAccessible(userId, false);
    return plants.map((p) => p.plantName);
  }

  /**
   * Returns a 403 CommonResponse if the user (non-admin) cannot access plantName.
   * Returns null when access is granted.
   */
  private async checkPlantAccess(
    plantName: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse | null> {
    if (isAdmin) return null;
    const names = await this.getAccessiblePlantNames(userId);
    if (!names.includes(plantName)) {
      return new CommonResponse(
        false,
        403,
        `Access denied: you are not assigned to plant "${plantName}"`,
        null,
      );
    }
    return null;
  }

  // ── Item-totals builder ──────────────────────────────────────────────────

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

  // ── Inventory helpers ─────────────────────────────────────────────────────

  /**
   * Returns available slot count per iceTypeId for a given plant.
   * Only considers batches that have at least one available slot.
   */
  async getStockByPlant(plantUnit: string): Promise<{ iceTypeId: number; availableCount: number }[]> {
    const batches = await this.batchRepo.find({ where: { plantUnit } });
    const result: Map<number, number> = new Map();
    for (const batch of batches) {
      const prev = result.get(batch.iceTypeId) ?? 0;
      result.set(batch.iceTypeId, prev + batch.availableCount);
    }
    return [...result.entries()].map(([iceTypeId, availableCount]) => ({ iceTypeId, availableCount }));
  }

  /**
   * FIFO slot deduction inside an existing transaction.
   * Marks the oldest available slots for each iceType as sold.
   * Soft-fails if no inventory is configured (no batches) to preserve backwards compat.
   * Throws if inventory exists but is insufficient.
   */
  private async deductInventorySlots(
    txSlotRepo: Repository<IceSlot>,
    txBatchRepo: Repository<IceBatch>,
    plantUnit: string,
    items: SaleItemInput[],
    saleId: number,
    soldBy: string,
  ): Promise<void> {
    const batches = await txBatchRepo.find({ where: { plantUnit } });
    if (batches.length === 0) return; // no inventory configured — allow sale through

    const now = new Date();

    for (const item of items) {
      const qty = item.quantity;
      if (!qty || qty <= 0) continue;

      // Collect available slots for this iceTypeId, FIFO (oldest batch → lowest slot id)
      const batchIds = batches
        .filter((b) => b.iceTypeId === item.iceTypeId && b.availableCount > 0)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((b) => b.id);

      if (batchIds.length === 0) continue; // ice type not in inventory — skip

      const available = await txSlotRepo
        .createQueryBuilder('slot')
        .where('slot.batchId IN (:...batchIds)', { batchIds })
        .andWhere('slot.status = :status', { status: 'available' })
        .orderBy('slot.batchId', 'ASC')
        .addOrderBy('slot.id', 'ASC')
        .limit(qty)
        .getMany();

      if (available.length < qty) {
        const found = available.length;
        const iceTypeName = batches.find((b) => b.iceTypeId === item.iceTypeId)?.iceTypeName ?? `ID ${item.iceTypeId}`;
        throw new Error(
          `Not enough stock for "${iceTypeName}": requested ${qty}, available ${found}. ` +
          `Please check inventory or add a new batch.`,
        );
      }

      for (const slot of available) {
        slot.status = 'sold';
        slot.saleId = saleId;
        slot.soldAt = now;
        slot.soldBy = soldBy;
      }
      await txSlotRepo.save(available);

      // Recalc each affected batch's counts
      const affectedBatchIds = [...new Set(available.map((s) => s.batchId))];
      for (const batchId of affectedBatchIds) {
        const batch = await txBatchRepo.findOne({ where: { id: batchId } });
        if (!batch) continue;
        const [avail, sold, reserved, damaged] = await Promise.all([
          txSlotRepo.count({ where: { batchId, status: 'available' } }),
          txSlotRepo.count({ where: { batchId, status: 'sold' } }),
          txSlotRepo.count({ where: { batchId, status: 'reserved' } }),
          txSlotRepo.count({ where: { batchId, status: 'damaged' } }),
        ]);
        batch.availableCount = avail;
        batch.soldCount      = sold;
        batch.reservedCount  = reserved;
        batch.damagedCount   = damaged;
        if (sold + damaged >= batch.totalSlots) batch.status = 'sold_out';
        await txBatchRepo.save(batch);
      }
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Create a sale.
   * Non-admin users must be assigned to the target plant.
   * Automatically deducts from inventory slots (FIFO) when batches exist.
   */
  async create(
    createSaleDto: CreateSaleDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    const denied = await this.checkPlantAccess(createSaleDto.unit, userId, isAdmin);
    if (denied) return denied;

    await this.transactionManager.startTransaction();
    try {
      const saleRepo  = this.transactionManager.getRepository(this.salesRepository);
      const slotTx    = this.transactionManager.getRepository(this.slotRepo);
      const batchTx   = this.transactionManager.getRepository(this.batchRepo);

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

      // Auto-deduct from inventory (FIFO). Soft-skips if no batches configured.
      await this.deductInventorySlots(
        slotTx,
        batchTx,
        createSaleDto.unit,
        createSaleDto.items.filter((i) => i.quantity > 0),
        savedSale.id,
        createSaleDto.soldBy,
      );

      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 201, 'Sale created successfully', savedSale);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      const isStock = message.includes('Not enough stock');
      return new CommonResponse(false, isStock ? 409 : (message.includes('required') ? 400 : 500), message, null);
    }
  }

  /** Update a sale. Admin-only (enforced at the controller by RolesGuard). */
  async update(saleId: number, updateSaleDto: SaleUpdateDto): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const sale = await this.salesRepository.findOne({ where: { id: saleId } });
      if (!sale) throw new Error('Sale not found');

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

  /**
   * Return all sales.
   * ADMIN  → entire table.
   * USER   → only sales whose unit (plant name) the user is assigned to.
   *          Resolved via a single IN query — data never leaves the DB for inaccessible rows.
   */
  async getAllSales(userId: string, isAdmin: boolean, limit = 1000): Promise<CommonResponse> {
    try {
      // Cap result size so this endpoint can't degrade into a full-table dump
      const take = Math.min(Math.max(limit, 1), 5000);
      let sales: Sale[];

      if (isAdmin) {
        sales = await this.salesRepository.find({ order: { id: 'DESC' }, take });
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (names.length === 0) {
          return new CommonResponse(true, 200, 'Sales fetched successfully', []);
        }
        sales = await this.salesRepository.find({
          where: { unit: In(names) },
          order: { id: 'DESC' },
          take,
        });
      }

      return new CommonResponse(true, 200, 'Sales fetched successfully', sales);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Credit (khata) summary: per-customer billed / paid / outstanding across
   * their orders, scoped to the staff user's accessible plants. Cancelled
   * orders are excluded.
   */
  async getCreditSummary(userId: string, isAdmin: boolean): Promise<CommonResponse> {
    try {
      let sales: Sale[];
      if (isAdmin) {
        sales = await this.salesRepository.find({
          where: { customerId: Not(IsNull()) },
          order: { id: 'DESC' },
        });
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (names.length === 0) return new CommonResponse(true, 200, 'Credit summary fetched', []);
        sales = await this.salesRepository.find({
          where: { customerId: Not(IsNull()), unit: In(names) },
          order: { id: 'DESC' },
        });
      }

      const active = sales.filter((s) => s.fulfillmentStatus !== 'CANCELLED');
      if (active.length === 0) return new CommonResponse(true, 200, 'Credit summary fetched', []);

      const payments = await this.paymentRepo.find({
        where: { saleId: In(active.map((s) => s.id)) },
        order: { createdAt: 'DESC' },
      });
      const latestPayment = new Map<number, Payment>();
      for (const p of payments) {
        if (!latestPayment.has(p.saleId)) latestPayment.set(p.saleId, p);
      }

      interface CreditRow {
        customerId: string;
        name: string;
        mobile: string;
        orders: number;
        unpaidOrders: number;
        billed: number;
        paid: number;
        outstanding: number;
        oldestUnpaidDate: string | null;
      }
      const byCustomer = new Map<string, CreditRow>();

      for (const sale of active) {
        const id = sale.customerId as string;
        let row = byCustomer.get(id);
        if (!row) {
          // sales are DESC — first sighting carries the latest contact details
          row = {
            customerId: id, name: sale.name, mobile: sale.mobile,
            orders: 0, unpaidOrders: 0, billed: 0, paid: 0, outstanding: 0, oldestUnpaidDate: null,
          };
          byCustomer.set(id, row);
        }
        const amount = Number(sale.totalAmount);
        const isPaid = latestPayment.get(sale.id)?.status === 'PAID';
        row.orders += 1;
        row.billed = Math.round((row.billed + amount) * 100) / 100;
        if (isPaid) {
          row.paid = Math.round((row.paid + amount) * 100) / 100;
        } else {
          row.unpaidOrders += 1;
          row.outstanding = Math.round((row.outstanding + amount) * 100) / 100;
          if (!row.oldestUnpaidDate || sale.date < row.oldestUnpaidDate) {
            row.oldestUnpaidDate = sale.date;
          }
        }
      }

      const result = [...byCustomer.values()].sort((a, b) => b.outstanding - a.outstanding);
      return new CommonResponse(true, 200, 'Credit summary fetched', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /**
   * Customer orders for the plants this staff user can access.
   * Includes payment status + fulfillment fields so operators can act on them.
   */
  async getCustomerOrders(userId: string, isAdmin: boolean): Promise<CommonResponse> {
    try {
      let sales: Sale[];

      if (isAdmin) {
        sales = await this.salesRepository.find({
          where: { customerId: Not(IsNull()) },
          order: { id: 'DESC' },
          take: 1000,
        });
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (names.length === 0) {
          return new CommonResponse(true, 200, 'Customer orders fetched successfully', []);
        }
        sales = await this.salesRepository.find({
          where: { customerId: Not(IsNull()), unit: In(names) },
          order: { id: 'DESC' },
          take: 1000,
        });
      }

      if (sales.length === 0) {
        return new CommonResponse(true, 200, 'Customer orders fetched successfully', []);
      }

      const saleIds = sales.map((s) => s.id);
      const payments = await this.paymentRepo.find({
        where: { saleId: In(saleIds) },
        order: { createdAt: 'DESC' },
      });

      const latestPayment = new Map<number, Payment>();
      for (const p of payments) {
        if (!latestPayment.has(p.saleId)) latestPayment.set(p.saleId, p);
      }

      const orders = sales.map((sale) => ({
        ...sale,
        payment:       latestPayment.get(sale.id) ?? null,
        paymentStatus: latestPayment.get(sale.id)?.status ?? 'NOT_INITIATED',
      }));

      return new CommonResponse(true, 200, 'Customer orders fetched successfully', orders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
    }
  }

  /** Delete one sale. Admin-only (enforced at the controller by RolesGuard). */
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

  /** Delete multiple sales. Admin-only (enforced at the controller by RolesGuard). */
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

  /**
   * Fetch a single sale by ID.
   * Non-admin users can only fetch sales from their assigned plants.
   */
  async findOne(id: number, userId: string, isAdmin: boolean): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepository.findOne({ where: { id } });
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);

      const denied = await this.checkPlantAccess(sale.unit, userId, isAdmin);
      if (denied) return denied;

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
   * Return invoice print data for a sale.
   * Non-admin users can only print sales from their assigned plants.
   */
  async getPrintData(id: number, userId: string, isAdmin: boolean): Promise<CommonResponse> {
    try {
      const sale = await this.salesRepository.findOne({ where: { id } });
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);

      const denied = await this.checkPlantAccess(sale.unit, userId, isAdmin);
      if (denied) return denied;

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

  /** Dashboard metrics — admin only (enforced at the controller). */
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

    const todayTotal     = sumAmount(todaySales);
    const weekTotal      = sumAmount(weekSales);
    const monthTotal     = sumAmount(monthSales);
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
