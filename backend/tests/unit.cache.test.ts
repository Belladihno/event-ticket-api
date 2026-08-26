import { seatAvailabilityKey, invalidateSeatAvailability } from '../src/modules/seats/seats.service';

jest.mock('../src/config/redis.config', () => ({
  redis: { del: jest.fn().mockResolvedValue(1) },
}));

import { redis } from '../src/config/redis.config';

describe('seats availability cache helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('seatAvailabilityKey', () => {
    it('builds a namespaced key per section', () => {
      expect(seatAvailabilityKey('sec-123')).toBe('seats:available:sec-123');
    });

    it('is deterministic', () => {
      expect(seatAvailabilityKey('abc')).toBe(seatAvailabilityKey('abc'));
    });
  });

  describe('invalidateSeatAvailability', () => {
    it('deletes one key per unique sectionId', async () => {
      const delMock = (redis.del as unknown as jest.Mock).mockResolvedValue(1);
      await invalidateSeatAvailability(['s1', 's2']);
      expect(delMock).toHaveBeenCalledWith('seats:available:s1', 'seats:available:s2');
    });

    it('deduplicates sectionIds', async () => {
      const delMock = (redis.del as unknown as jest.Mock).mockResolvedValue(1);
      await invalidateSeatAvailability(['s1', 's1', 's2']);
      expect(delMock).toHaveBeenCalledWith('seats:available:s1', 'seats:available:s2');
    });

    it('no-ops for empty array (does not call redis)', async () => {
      const delMock = (redis.del as unknown as jest.Mock);
      await invalidateSeatAvailability([]);
      expect(delMock).not.toHaveBeenCalled();
    });

    it('filters falsy ids', async () => {
      const delMock = (redis.del as unknown as jest.Mock).mockResolvedValue(1);
      await invalidateSeatAvailability(['', 's1']);
      expect(delMock).toHaveBeenCalledWith('seats:available:s1');
    });
  });
});
