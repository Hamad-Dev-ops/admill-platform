export interface IPaginationParams {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Accepts Express's req.query (qs.ParsedQs) as-is — every value is `unknown` to us
// until Number()-coerced, so no narrower type is needed or helpful here.
export function resolvePagination(query: Record<string, unknown>): IPaginationParams {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(query.limit)) || DEFAULT_LIMIT));

  return { page, limit, skip: (page - 1) * limit };
}
