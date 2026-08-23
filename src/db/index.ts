import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let tablesInitialized = false;

async function initTables(p: Pool) {
  if (tablesInitialized) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS imported_files (
        id serial PRIMARY KEY,
        file_name text NOT NULL,
        imported_at timestamp DEFAULT now() NOT NULL,
        total_rows integer DEFAULT 0,
        headers jsonb NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dealer_records (
        id serial PRIMARY KEY,
        file_id integer,
        data text,
        entrada numeric(12, 2),
        saida numeric(12, 2),
        conta_classificacao text,
        historico text,
        raw_content jsonb,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rule_presets (
        id text PRIMARY KEY,
        name text NOT NULL,
        description text,
        rules_config jsonb NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shared_fechamentos (
        id text PRIMARY KEY,
        title text NOT NULL,
        data_movimento text NOT NULL,
        created_by jsonb NOT NULL,
        status text NOT NULL DEFAULT 'active',
        items jsonb NOT NULL,
        conciliated_empresas jsonb NOT NULL DEFAULT '{}'::jsonb,
        summary jsonb NOT NULL,
        dealer_state jsonb,
        sitef_state jsonb,
        pendente_cdc_state jsonb,
        kicked_user_ids jsonb DEFAULT '[]'::jsonb,
        active_participants jsonb NOT NULL DEFAULT '[]'::jsonb,
        chat_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
        version integer DEFAULT 1,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fechamento_records (
        id text PRIMARY KEY,
        data_movimento text NOT NULL,
        data_fechamento text NOT NULL,
        operador text NOT NULL,
        observacoes text,
        total_dealer numeric(14, 2),
        total_sitef numeric(14, 2),
        diferenca_total numeric(14, 2),
        count_total integer DEFAULT 0,
        count_empresas integer DEFAULT 0,
        empresas_nomes jsonb NOT NULL,
        breakdown_por_bandeira jsonb NOT NULL,
        status text NOT NULL,
        items jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    tablesInitialized = true;
  } catch (err) {
    console.warn('Auto-init tables warning:', err);
  }
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    initTables(pool).catch(() => {});
  }

  return drizzle(pool, { schema });
}

