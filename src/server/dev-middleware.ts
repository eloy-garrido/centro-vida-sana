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
    if (isNew) {
      const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
      const sql = readFileSync(migrationPath, 'utf-8');
      db.exec(sql);
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
  const webResponse = await handleApiRequest(webRequest, adapter);

  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  const responseBody = await webResponse.arrayBuffer();
  res.end(Buffer.from(responseBody));
}
