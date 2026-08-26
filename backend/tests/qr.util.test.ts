import { signQrPayload, verifyQrPayload } from '../src/common/utils/qr.util';

const ids = {
  ticketId: 'ticket-1',
  userId: 'user-1',
  eventId: 'event-1',
};

describe('qr.util', () => {
  it('signs a payload that verifies successfully', () => {
    const payload = signQrPayload(ids.ticketId, ids.userId, ids.eventId);

    expect(payload).toMatchObject({ ...ids });
    expect(payload.signature).toMatch(/^[0-9a-f]{64}$/); // hex sha256
    expect(verifyQrPayload(payload)).toBe(true);
  });

  it('produces a stable signature for identical input', () => {
    const a = signQrPayload(ids.ticketId, ids.userId, ids.eventId);
    const b = signQrPayload(ids.ticketId, ids.userId, ids.eventId);

    expect(a.signature).toBe(b.signature);
  });

  it('rejects a tampered ticket id', () => {
    const payload = signQrPayload(ids.ticketId, ids.userId, ids.eventId);
    const tampered = { ...payload, ticketId: 'ticket-2' };

    expect(verifyQrPayload(tampered)).toBe(false);
  });

  it('rejects a tampered user id', () => {
    const payload = signQrPayload(ids.ticketId, ids.userId, ids.eventId);
    const tampered = { ...payload, userId: 'attacker' };

    expect(verifyQrPayload(tampered)).toBe(false);
  });

  it('rejects a tampered event id (wrong-event ticket)', () => {
    const payload = signQrPayload(ids.ticketId, ids.userId, ids.eventId);
    const tampered = { ...payload, eventId: 'other-event' };

    expect(verifyQrPayload(tampered)).toBe(false);
  });

  it('rejects an entirely fabricated signature', () => {
    const forged = { ...ids, signature: 'f'.repeat(64) };

    expect(verifyQrPayload(forged)).toBe(false);
  });
});
