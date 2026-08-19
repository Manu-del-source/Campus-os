/**
 * Minimal `.env` loader for the test runner.
 *
 * Tests run against the *development* database configured by `DATABASE_URL`
 * (there is deliberately no separate test database URL). Vitest does not read
 * `.env` files, so we load them here without overriding variables that are
 * already present in the environment.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_FILES = ['.env.test.local', '.env.local', '.env.test', '.env'];

function parse(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf('=');
    if (separator === -1) continue;
    const key = withoutExport.slice(0, separator).trim();
    if (!key) continue;
    let value = withoutExport.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Loads `.env` files into `process.env` (existing variables win). */
export function loadEnvFiles(root: string = process.cwd()): void {
  for (const file of ENV_FILES) {
    const filePath = path.join(root, file);
    if (!existsSync(filePath)) continue;
    for (const [key, value] of Object.entries(parse(readFileSync(filePath, 'utf8')))) {
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

export const MISSING_DATABASE_URL_MESSAGE = [
  'DATABASE_URL is not set.',
  '',
  'CampusOS tests run against the same database as development — there is no',
  'separate test database URL. Copy .env.example to .env and set DATABASE_URL',
  '(and DIRECT_URL when the connection is pooled), or export DATABASE_URL for',
  'this command:',
  '',
  '  DATABASE_URL="postgresql://user:password@host/db" npm test',
  '',
  'WARNING: integration tests truncate application tables in that database.',
].join('\n');

/**
 * Resolves the single database URL used by the whole test suite.
 * Also normalises `DIRECT_URL`, which migrations prefer.
 */
export function requireDatabaseUrl(): string {
  loadEnvFiles();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(MISSING_DATABASE_URL_MESSAGE);
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = url;
  }
  return url;
}
