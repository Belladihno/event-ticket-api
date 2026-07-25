import { DataSource } from 'typeorm';
import { config } from './app.config';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.name,
  synchronize: false,
  logging: config.nodeEnv === 'development',
  entities: [__dirname + '/../modules/**/*.entity.{js,ts}'],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
});