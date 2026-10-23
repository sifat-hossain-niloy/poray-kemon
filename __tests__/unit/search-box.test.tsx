import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/lib/i18n/client'
import { SearchBox } from '@/components/search/SearchBox'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const results = [
  {
    kind: 'professor',
    id: 1,
    slug: 'AAAA1111',
    title: 'Rated Prof',
    subtitle: 'DU · CSE',
    score: 1,
    href: '/professors/AAAA1111',
    stats: { overallScore: 4.25, reviewCount: 8, topTags: [] },
  },
  {
    kind: 'professor',
    id: 2,
    slug: 'BBBB2222',
    title: 'Unrated Prof',
    subtitle: 'DU · EEE',
    score: 1,
    href: '/professors/BBBB2222',
    stats: { overallScore: null, reviewCount: 0, topTags: [] },
  },
]

afterEach(() => vi.unstubAllGlobals())

describe('SearchBox dropdown', () => {
  it('shows the overall score for rated professors only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ results }))),
    )
    render(
      <LocaleProvider locale="en">
        <SearchBox variant="compact" />
      </LocaleProvider>,
    )
    vi.useFakeTimers()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'prof' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    vi.useRealTimers()

    const rated = screen.getByText('Rated Prof').closest('a')
    const unrated = screen.getByText('Unrated Prof').closest('a')
    expect(rated).toHaveTextContent('4.3')
    expect(unrated?.textContent).not.toMatch(/★/)
  })
})
