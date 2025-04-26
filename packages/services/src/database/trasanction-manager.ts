import { Injectable } from '@nestjs/common';
import { DataSource, ObjectLiteral, QueryRunner, Repository } from 'typeorm';

export interface ITransactionHelper {
  startTransaction(): Promise<void>;
  completeTransaction(work: () => Promise<void>): Promise<void>;
  getRepository<T extends ObjectLiteral>(entity: Repository<T>): Repository<T>;
}

@Injectable()
export class GenericTransactionManager implements ITransactionHelper {
  private queryRunner: QueryRunner;

  constructor(private readonly dataSource: DataSource) {}

  async startTransaction(): Promise<void> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();
  }

  getQueryRunner(): QueryRunner {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Please call startTransaction() first.');
    }
    return this.queryRunner;
  }

  async commitTransaction(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Please call startTransaction() first.');
    }
    try {
      await this.queryRunner.commitTransaction();
    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await this.queryRunner.release();
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Please call startTransaction() first.');
    }
    await this.queryRunner.rollbackTransaction();
    await this.queryRunner.release();
  }

  getRepository<T extends ObjectLiteral>(entity: Repository<T>): Repository<T> {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Please call startTransaction() first.');
    }
    return this.queryRunner.manager.getRepository(entity.target as any);
  }

  async completeTransaction(work: () => Promise<void>): Promise<void> {
    try {
      await work();
      await this.commitTransaction();
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }
}
