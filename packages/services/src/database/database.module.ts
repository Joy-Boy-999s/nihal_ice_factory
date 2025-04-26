import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 19941;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

export const DatabaseModule = TypeOrmModule.forRoot({
  type: 'mysql',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  migrations: ['dist/database/migrations/*.{ts,js}'],
  synchronize: true,
  autoLoadEntities: true,
  extra: {
    connectionLimit: 10, 
    keepAlive: true,
  },
  ssl: {
    rejectUnauthorized: false, 
  },
});