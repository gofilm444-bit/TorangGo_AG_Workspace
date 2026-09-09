import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  moneySchema,
  geoPointSchema,
  isoUtcTimestampSchema,
  distanceMetersSchema,
  appAudienceSchema,
  apiErrorResponseSchema,
} from './index.js';

describe('Validation Foundation Suite', () => {
  describe('moneySchema', () => {
    it('accepts valid IDR whole integer amounts', () => {
      const parsed = moneySchema.parse({ amount: 50000, currency: 'IDR' });
      assert.equal(parsed.amount, 50000);
      assert.equal(parsed.currency, 'IDR');
    });

    it('rejects fractional/decimal Rupiah amounts', () => {
      assert.throws(() => {
        moneySchema.parse({ amount: 50000.5, currency: 'IDR' });
      }, /Money amount must be a whole integer Rupiah value/);
    });

    it('rejects negative Rupiah amounts', () => {
      assert.throws(() => {
        moneySchema.parse({ amount: -100, currency: 'IDR' });
      }, /Money amount must be non-negative/);
    });

    it('rejects non-IDR currencies', () => {
      assert.throws(() => {
        moneySchema.parse({ amount: 1000, currency: 'USD' });
      });
    });
  });

  describe('geoPointSchema', () => {
    it('accepts valid WGS84 coordinates in Manado', () => {
      const point = geoPointSchema.parse({ lat: 1.4855, lng: 124.8384 });
      assert.equal(point.lat, 1.4855);
      assert.equal(point.lng, 124.8384);
    });

    it('rejects latitude out of bounds ([-90, 90])', () => {
      assert.throws(() => {
        geoPointSchema.parse({ lat: 91.5, lng: 124.8384 });
      });
    });

    it('rejects longitude out of bounds ([-180, 180])', () => {
      assert.throws(() => {
        geoPointSchema.parse({ lat: 1.4855, lng: 181.0 });
      });
    });
  });

  describe('isoUtcTimestampSchema', () => {
    it('accepts valid ISO 8601 UTC timestamps', () => {
      const valid = '2026-09-09T03:00:00.000Z';
      assert.equal(isoUtcTimestampSchema.parse(valid), valid);
    });

    it('rejects non-UTC timestamps without Z suffix', () => {
      assert.throws(() => {
        isoUtcTimestampSchema.parse('2026-09-09T03:00:00');
      });
    });

    it('rejects invalid date strings', () => {
      assert.throws(() => {
        isoUtcTimestampSchema.parse('invalid-timestamp-string');
      });
    });
  });

  describe('distanceMetersSchema', () => {
    it('accepts valid distance in whole meters', () => {
      assert.equal(distanceMetersSchema.parse(1250), 1250);
      assert.equal(distanceMetersSchema.parse(0), 0);
    });

    it('rejects negative distance', () => {
      assert.throws(() => {
        distanceMetersSchema.parse(-5);
      });
    });

    it('rejects fractional distance', () => {
      assert.throws(() => {
        distanceMetersSchema.parse(1250.75);
      });
    });
  });

  describe('appAudienceSchema', () => {
    it('accepts all 4 valid platform audiences', () => {
      const audiences = ['CUSTOMER_APP', 'MERCHANT_APP', 'DRIVER_APP', 'ADMIN_WEB'] as const;
      for (const aud of audiences) {
        assert.equal(appAudienceSchema.parse(aud), aud);
      }
    });

    it('rejects unknown audience', () => {
      assert.throws(() => {
        appAudienceSchema.parse('SUPER_ADMIN_DESKTOP');
      });
    });
  });

  describe('apiErrorResponseSchema', () => {
    it('validates a standard TorangGo error response', () => {
      const err = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input payload',
          details: [{ field: 'amount', message: 'Required' }],
          request_id: 'req-1234-uuid',
        },
      };
      const parsed = apiErrorResponseSchema.parse(err);
      assert.equal(parsed.error.code, 'VALIDATION_ERROR');
      assert.equal(parsed.error.request_id, 'req-1234-uuid');
    });
  });
});

