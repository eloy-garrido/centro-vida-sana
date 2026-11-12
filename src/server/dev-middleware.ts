/**
 * Centro Vida Sana Austral — Middleware de Desarrollo Local para Vite/Astro
 * Enruta /api/* hacia handleApiRequest con una base SQLite local persistente en .dev-db/
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSqliteAdapter, type DatabaseAdapter } from './db/adapter.ts';
import { handleApiRequest } from './router.ts';

let devDbAdapter: DatabaseAdapter | null = null;

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadLocalEnv();

export function getDevDatabase(): DatabaseAdapter {
  if (!devDbAdapter) {
    const dataDir = resolve(process.cwd(), '.dev-db');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = resolve(dataDir, 'local.sqlite');
    const isNew = !existsSync(dbPath);
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    const migrationFiles = ['0001_initial_schema.sql', '0002_attendance_tracking.sql', '0003_patient_notes.sql'];
    if (isNew) {
      for (const file of migrationFiles) {
        const migrationPath = resolve(process.cwd(), 'migrations', file);
        const sql = readFileSync(migrationPath, 'utf-8');
        db.exec(sql);
      }
    } else {
      // Verificar si ya se aplicó la migración 0002 (attendance_status)
      try {
        const cols = db.prepare("PRAGMA table_info('agenda_entries')").all() as { name: string }[];
        if (!cols.some(c => c.name === 'attendance_status')) {
          const migrationPath = resolve(process.cwd(), 'migrations/0002_attendance_tracking.sql');
          const sql = readFileSync(migrationPath, 'utf-8');
          db.exec(sql);
        }
        db.prepare("UPDATE agenda_entries SET attendance_status = 'attended' WHERE attendance_status = 'pending'").run();
      } catch (err) {
        console.warn('Advertencia al verificar columnas de asistencia en dev DB:', err);
      }

      // Verificar si ya se aplicó la migración 0003 (patient_notes)
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_notes'").all() as { name: string }[];
        if (tables.length === 0) {
          const migrationPath = resolve(process.cwd(), 'migrations/0003_patient_notes.sql');
          const sql = readFileSync(migrationPath, 'utf-8');
          db.exec(sql);
        }
      } catch (err) {
        console.warn('Advertencia al verificar patient_notes en dev DB:', err);
      }
    }
    devDbAdapter = createSqliteAdapter(db);
  }
  return devDbAdapter;
}

export async function handleDevApiRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host || 'localhost:4321';
  const url = `http://${host}${req.url || '/'}`;
  const method = req.method || 'GET';

  // Recolectar body si existe
  let bodyBuffer: Buffer | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    bodyBuffer = Buffer.concat(chunks);
  }

  const webHeaders = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val !== undefined) {
      if (Array.isArray(val)) {
        for (const item of val) webHeaders.append(key, item);
      } else {
        webHeaders.set(key, val);
      }
    }
  }

  const webRequest = new Request(url, {
    method,
    headers: webHeaders,
    body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined
  });

  const adapter = getDevDatabase();
  const webResponse = await handleApiRequest(webRequest, adapter, { isDev: true });

  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  const responseBody = await webResponse.arrayBuffer();
  res.end(Buffer.from(responseBody));
}
