import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonResponse, SaleUpdateDto } from '@nihal-ice-factory/shared-models';
import { CreateSaleDto } from './dto/create-sale.dto';
import { GenericTransactionManager } from '../../database/trasanction-manager';
import { SalesRepository } from './repository/sales.repository';

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
