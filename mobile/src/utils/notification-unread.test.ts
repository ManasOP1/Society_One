import { unreadNotificationIds } from '@/utils/notification-unread';

describe('unreadNotificationIds', () => {
  it('returns only unseen ids', () => {
    const seen = new Set(['a', 'b']);
    expect(unreadNotificationIds(['a', 'b', 'c', 'd'], seen)).toEqual(['c', 'd']);
  });

  it('returns empty when everything is seen', () => {
    const seen = new Set(['a', 'b']);
    expect(unreadNotificationIds(['a', 'b'], seen)).toEqual([]);
  });

  it('skips empty ids', () => {
    const seen = new Set<string>();
    expect(unreadNotificationIds(['', 'x'], seen)).toEqual(['x']);
  });
});
