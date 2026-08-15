import { asc, desc, type AnyColumn, type SQL, type SQLWrapper } from 'drizzle-orm';

export type OrderDirection = 'asc' | 'desc';

export function totalOrder(
  primaryOrder: readonly SQL[],
  idColumn: AnyColumn | SQLWrapper,
  idDirection: OrderDirection = 'asc',
): SQL[] {
  return [...primaryOrder, idDirection === 'asc' ? asc(idColumn) : desc(idColumn)];
}

export function pagination(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
