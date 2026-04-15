// src/database/database.module.ts

import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
	imports: [
		// Make sure ConfigModule is global (you already did this in AppModule)
		ConfigModule,
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (cfg: ConfigService) => {
				const nodeEnv = (cfg.get<string>('NODE_ENV') || 'development').toLowerCase();
				const isProduction = nodeEnv === 'production';

				const dbLoggingRaw = (cfg.get<string>('DB_LOGGING') || '').toLowerCase();
				const dbLoggingEnabled =
					dbLoggingRaw === 'true' || dbLoggingRaw === '1' || dbLoggingRaw === 'yes';

				// Pull each value, throw if missing
				const host = cfg.get<string>('DB_HOST');
				if (!host) {
					Logger.error('Missing DB_HOST env var');
					throw new Error('DB_HOST is required');
				}

				const portStr = cfg.get<string>('DB_PORT');
				if (!portStr) {
					Logger.error('Missing DB_PORT env var');
					throw new Error('DB_PORT is required');
				}
				const port = parseInt(portStr, 10);

				const username = cfg.get<string>('DB_USER');
				if (!username) {
					Logger.error('Missing DB_USER env var');
					throw new Error('DB_USER is required');
				}

				const password = cfg.get<string>('DB_PASSWORD');
				if (password == null) {
					Logger.error('Missing DB_PASSWORD env var');
					throw new Error('DB_PASSWORD is required');
				}

				const database = cfg.get<string>('DB_NAME');
				if (!database) {
					Logger.error('Missing DB_NAME env var');
					throw new Error('DB_NAME is required');
				}

				return {
					type: 'mysql' as const,
					connectorPackage: 'mysql2' as const,
					host,
					port,
					username,
					password,
					database,
					migrations: ['dist/database/migrations/*.{ts,js}'],
					synchronize: true,
					logging: dbLoggingEnabled
						? ['query', 'error', 'warn', 'schema', 'migration']
						: !isProduction,
					logger: 'advanced-console' as const,
					maxQueryExecutionTime: 500,
					autoLoadEntities: true,
					extra: {
						connectionLimit: 10,
						keepAlive: true,
					},
					ssl: {
						rejectUnauthorized: false,
					},
				};
			},
		}),
	],
})
export class DatabaseModule { }
