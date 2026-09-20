import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  snakeToCamelString,
  camelToSnakeString,
  snakeToCamel,
  camelToSnake,
} from './case-mapper.js';

describe('Case Mapping Suite', () => {
  describe('string case conversion', () => {
    it('converts snake_case to camelCase string', () => {
      assert.equal(snakeToCamelString('request_id'), 'requestId');
      assert.equal(snakeToCamelString('next_cursor'), 'nextCursor');
      assert.equal(snakeToCamelString('x_request_id'), 'xRequestId');
      assert.equal(snakeToCamelString('created_at'), 'createdAt');
      assert.equal(snakeToCamelString('simple'), 'simple');
    });

    it('converts camelCase to snake_case string', () => {
      assert.equal(camelToSnakeString('requestId'), 'request_id');
      assert.equal(camelToSnakeString('nextCursor'), 'next_cursor');
      assert.equal(camelToSnakeString('xRequestId'), 'x_request_id');
      assert.equal(camelToSnakeString('createdAt'), 'created_at');
      assert.equal(camelToSnakeString('simple'), 'simple');
    });
  });

  describe('snakeToCamel object mapper', () => {
    it('recursively converts nested objects and arrays', () => {
      const httpPayload = {
        request_id: 'req-1',
        total_amount: 50000,
        currency_code: 'IDR',
        pagination_meta: {
          next_cursor: 'cursor_xyz',
          has_more: true,
        },
        items_list: [
          { item_id: '1', unit_price: 15000 },
          { item_id: '2', unit_price: 35000 },
        ],
      };

      const result = snakeToCamel<{
        requestId: string;
        totalAmount: number;
        currencyCode: string;
        paginationMeta: {
          nextCursor: string;
          hasMore: boolean;
        };
        itemsList: Array<{ itemId: string; unitPrice: number }>;
      }>(httpPayload);

      assert.deepEqual(result, {
        requestId: 'req-1',
        totalAmount: 50000,
        currencyCode: 'IDR',
        paginationMeta: {
          nextCursor: 'cursor_xyz',
          hasMore: true,
        },
        itemsList: [
          { itemId: '1', unitPrice: 15000 },
          { itemId: '2', unitPrice: 35000 },
        ],
      });
    });

    it('preserves Date objects, primitives, null and undefined', () => {
      const date = new Date();
      const input = {
        created_at: date,
        is_active: true,
        count: 0,
        empty_field: null,
        missing: undefined,
      };

      const result = snakeToCamel<Record<string, unknown>>(input);
      assert.equal(result.createdAt, date);
      assert.equal(result.isActive, true);
      assert.equal(result.count, 0);
      assert.equal(result.emptyField, null);
      assert.equal(result.missing, undefined);
    });
  });

  describe('camelToSnake object mapper', () => {
    it('recursively converts nested camelCase objects back to snake_case', () => {
      const internalModel = {
        requestId: 'req-1',
        totalAmount: 50000,
        currencyCode: 'IDR',
        paginationMeta: {
          nextCursor: 'cursor_xyz',
          hasMore: true,
        },
        itemsList: [
          { itemId: '1', unitPrice: 15000 },
          { itemId: '2', unitPrice: 35000 },
        ],
      };

      const result = camelToSnake(internalModel);

      assert.deepEqual(result, {
        request_id: 'req-1',
        total_amount: 50000,
        currency_code: 'IDR',
        pagination_meta: {
          next_cursor: 'cursor_xyz',
          has_more: true,
        },
        items_list: [
          { item_id: '1', unit_price: 15000 },
          { item_id: '2', unit_price: 35000 },
        ],
      });
    });
  });
});

