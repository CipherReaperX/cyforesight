import 'dotenv/config';  // ← Add this line
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const queryClient = postgres(connectionString, {
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export default db;
