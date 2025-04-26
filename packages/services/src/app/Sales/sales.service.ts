import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { GenericTransactionManager } from '../../database/trasanction-manager';
import { SalesRepository } from './repository/sales.repository';

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly transactionManager: GenericTransactionManager,
  ) {}

  private calculateTotalAmount(cans: number, blocks: number, pieces: number): number {
    const pricePerCan = 240;
    const pricePerBlock = 80;
    const pricePerPiece = 20;
    return cans * pricePerCan + blocks * pricePerBlock + pieces * pricePerPiece;
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

  async findAll(): Promise<CommonResponse> {
    try {
      const sales = await this.salesRepository.find();
      return new CommonResponse(true, 200, 'Sales fetched successfully', sales);
    } catch (error) {
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

  async update(id: number, updateSaleDto: UpdateSaleDto): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const saleRepo = this.transactionManager.getRepository(this.salesRepository);
      const sale = await saleRepo.findOne({ where: { id } });
      if (!sale) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'Sale not found', null);
      }

      let totalAmount = sale.totalAmount;
      let totalCans = sale.totalCans;
      if (updateSaleDto.cans !== undefined || updateSaleDto.blocks !== undefined || updateSaleDto.pieces !== undefined) {
        const cans = updateSaleDto.cans ?? sale.cans;
        const blocks = updateSaleDto.blocks ?? sale.blocks;
        const pieces = updateSaleDto.pieces ?? sale.pieces;
        totalAmount = this.calculateTotalAmount(cans, blocks, pieces);
        totalCans = this.calculateTotalCans(cans, blocks, pieces);
      }

      await saleRepo.update(id, {
        ...updateSaleDto,
        totalAmount,
        totalCans,
      });
      const updatedSale = await saleRepo.findOne({ where: { id } });
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Sale updated successfully', updatedSale);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, 500, message, null);
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