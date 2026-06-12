import { Injectable, Scope } from '@nestjs/common';
import { DataSource, EntityTarget, ObjectLiteral, QueryRunner, Repository } from 'typeorm';

export interface ITransactionHelper {
  startTransaction(): Promise<void>;
  completeTransaction(work: () => Promise<void>): Promise<void>;
  getRepository<T extends ObjectLiteral>(entity: Repository<T>): Repository<T>;
}

/**
 * REQUEST-scoped on purpose: this class stores the active QueryRunner as
 * instance state. As a singleton, two concurrent requests would overwrite
 * each other's runner — commits/rollbacks would land on the wrong
 * transaction and connections would leak. Request scope gives every request
 * its own instance (Nest bubbles the scope up to consuming services).
 */
@Injectable({ scope: Scope.REQUEST })
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
    return this.queryRunner.manager.getRepository(entity.target as EntityTarget<T>);
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
