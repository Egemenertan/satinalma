const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const chunk = data || []
    all.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export async function fetchInChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  chunkSize = 200
): Promise<T[]> {
  if (ids.length === 0) return []
  const unique = [...new Set(ids.filter(Boolean))]
  const out: T[] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await query(chunk)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
  }
  return out
}
