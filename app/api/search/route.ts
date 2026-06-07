import { NextResponse } from 'next/server'
import { search } from '@/lib/search'

// JSON endpoint for live (debounced) search from the client.
// The full /search page still runs the same `search()` function for SEO.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 8), 20)

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const results = await search(q, limit)
  return NextResponse.json({ results })
}
