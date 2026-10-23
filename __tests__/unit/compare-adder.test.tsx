import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/lib/i18n/client'
import { CompareAdder } from '@/components/compare/CompareAdder'

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
    title: 'Already Here',
    subtitle: 'DU · CSE',
    score: 1,
    href: '',
  },
  {
    kind: 'professor',
    id: 2,
    slug: 'BBBB2222',
    title: 'New Prof',
    subtitle: 'DU · EEE',
    score: 1,
    href: '',
  },
  {
    kind: 'university',
    id: 3,
    slug: 'du',
    title: 'University of Dhaka',
    subtitle: '',
    score: 1,
    href: '',
  },
]

function setup(ids: string[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results })))
  vi.stubGlobal('fetch', fetchMock)
  render(
    <LocaleProvider locale="en">
      <CompareAdder ids={ids} labels={{ placeholder: 'Add a professor', noMatches: 'None' }} />
    </LocaleProvider>,
  )
  return { fetchMock, input: screen.getByLabelText('Add a professor') }
}

async function type(input: HTMLElement, value: string) {
  vi.useFakeTimers()
  fireEvent.change(input, { target: { value } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250)
  })
  vi.useRealTimers()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CompareAdder', () => {
  it('does not search for fewer than two characters', async () => {
    const { fetchMock, input } = setup([])
    await type(input, 'a')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lists only professors not already compared, linking to the extended comparison', async () => {
    const { fetchMock, input } = setup(['AAAA1111'])
    await type(input, 'pro')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search?q=pro&limit=10',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(screen.queryByText('Already Here')).toBeNull()
    expect(screen.queryByText('University of Dhaka')).toBeNull()
    const link = screen.getByText('New Prof').closest('a')
    expect(link).toHaveAttribute('href', '/en/compare?ids=AAAA1111,BBBB2222')
  })

  it('shows the empty message when every hit is filtered out', async () => {
    const { input } = setup(['AAAA1111', 'BBBB2222'])
    await type(input, 'pro')
    expect(screen.getByText('None')).toBeInTheDocument()
  })
})
