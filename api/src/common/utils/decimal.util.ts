/** Convert Prisma Decimal (or number/string) to a plain number for API responses. */
export function toNumber(
  value: { toString(): string } | number | string | null | undefined,
): number {
  if (value == null) return 0;
  return Number(value);
}
