/**
 * Case mapping utilities and types for converting between HTTP snake_case JSON
 * and internal TypeScript camelCase models.
 */

/**
 * Type-level conversion from snake_case to camelCase.
 */
export type SnakeToCamelCase<T> = T extends (infer U)[]
  ? SnakeToCamelCase<U>[]
  : T extends Date | RegExp | ((...args: unknown[]) => unknown)
    ? T
    : T extends object
      ? {
          [K in keyof T as K extends string
            ? K extends `${infer P1}_${infer P2}${infer P3}`
              ? `${P1}${Uppercase<P2>}${SnakeToCamelCaseHelper<P3>}`
              : K
            : K]: SnakeToCamelCase<T[K]>;
        }
      : T;

type SnakeToCamelCaseHelper<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Uppercase<P2>}${SnakeToCamelCaseHelper<P3>}`
  : S;

/**
 * Converts a single snake_case string to camelCase.
 * Examples:
 * - 'request_id' -> 'requestId'
 * - 'next_cursor' -> 'nextCursor'
 * - 'x_request_id' -> 'xRequestId'
 * - 'created_at' -> 'createdAt'
 */
export function snakeToCamelString(str: string): string {
  if (!str || !str.includes('_')) {
    return str;
  }
  return str.replace(/([-_][a-z0-9])/gi, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

/**
 * Converts a single camelCase string to snake_case.
 * Examples:
 * - 'requestId' -> 'request_id'
 * - 'nextCursor' -> 'next_cursor'
 * - 'xRequestId' -> 'x_request_id'
 * - 'createdAt' -> 'created_at'
 */
export function camelToSnakeString(str: string): string {
  if (!str) return str;
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Recursively converts object keys from snake_case to camelCase.
 * Preserves Date, RegExp, Buffers, null, undefined, and primitive types.
 */
export function snakeToCamel<T = unknown>(input: unknown): T {
  if (input === null || input === undefined || typeof input !== 'object') {
    return input as T;
  }

  if (input instanceof Date || input instanceof RegExp) {
    return input as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => snakeToCamel(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const camelKey = snakeToCamelString(key);
    result[camelKey] = snakeToCamel(value);
  }

  return result as T;
}

/**
 * Recursively converts object keys from camelCase to snake_case.
 * Preserves Date, RegExp, Buffers, null, undefined, and primitive types.
 */
export function camelToSnake<T = unknown>(input: unknown): T {
  if (input === null || input === undefined || typeof input !== 'object') {
    return input as T;
  }

  if (input instanceof Date || input instanceof RegExp) {
    return input as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => camelToSnake(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const snakeKey = camelToSnakeString(key);
    result[snakeKey] = camelToSnake(value);
  }

  return result as T;
}
