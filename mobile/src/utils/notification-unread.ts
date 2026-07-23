/** Pure helpers for unread notification counting (no native deps). */

export function unreadNotificationIds(itemIds: string[], seen: Set<string>): string[] {
  return itemIds.filter((id) => id && !seen.has(id));
}
