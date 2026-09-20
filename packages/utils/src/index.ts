export function getIsoTimestamp(): string {
  return new Date().toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export * from './uuidv7.js';
export * from './money.js';
export * from './case-mapper.js';
