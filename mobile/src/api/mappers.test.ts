import { mapRole } from '@/api/mappers';

describe('mapRole', () => {
  it('maps resident role for mobile app', () => {
    expect(mapRole('RESIDENT')).toBe('resident');
  });

  it('maps admin-like roles for compatibility but mobile rejects non-resident login', () => {
    expect(mapRole('SOCIETY_ADMIN')).toBe('admin');
  });
});
