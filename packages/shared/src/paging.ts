/**
 * The database answers at most 1,000 rows a request (PostgREST `db-max-rows`), whatever
 * `.limit()` asks for, and says nothing when it cuts a list short. A month's register
 * for 200 guards is 6,000 duties, so anything that can grow past that is read here, a
 * page at a time, until a short page says it is all in.
 *
 * Paging by offset needs a fixed order, so a tie-break on `id` is added after whatever
 * order the query already has (pass `tiebreak: null` for a table without one).
 */
export const PAGE_ROWS = 1000;

type Answer<T> = { data: T[] | null; error: { message: string } | null };
type Pageable<T> = PromiseLike<Answer<T>> & {
  range(from: number, to: number): PromiseLike<Answer<T>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order(column: any, options?: { ascending?: boolean }): Pageable<T>;
};

export async function fetchAll<T>(
  query: Pageable<T>,
  { tiebreak = "id", max = 200_000 }: { tiebreak?: string | null; max?: number } = {},
): Promise<{ data: T[]; error: { message: string } | null }> {
  const q = tiebreak ? query.order(tiebreak, { ascending: true }) : query;
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE_ROWS) {
    const { data, error } = await q.range(from, from + PAGE_ROWS - 1);
    if (error) return { data: out, error };
    if (data) for (const row of data) out.push(row);
    if (!data || data.length < PAGE_ROWS) break;
  }
  return { data: out, error: null };
}
