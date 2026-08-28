import { initE2E, clearDatabase, teardownE2E } from './helpers';

describe('minimal e2e', () => {
  beforeAll(async () => {
    await initE2E();
  }, 30000);

  afterAll(async () => {
    await teardownE2E();
  });

  it('connects to DB and Redis', async () => {
    await clearDatabase();
    expect(true).toBe(true);
  }, 30000);
});
