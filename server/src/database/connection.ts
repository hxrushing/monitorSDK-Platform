import { createConnection, Connection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let connection: Connection | null = null;

export async function getConnection(): Promise<Connection> {
  if (!connection) {
    connection = await createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  }
  return connection;
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
  }
}