import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { LocaleProvider } from '@/lib/i18n/client'
import { THEME_STORAGE_KEY } from '@/lib/theme'

let osDark = false

beforeEach(() => {
  osDark = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: osDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

function renderToggle(locale: 'en' | 'bn' = 'en') {
  return render(
    <LocaleProvider locale={locale}>
      <ThemeToggle />
    </LocaleProvider>,
  )
}

async function pick(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Theme:/ }))
  const option = await screen.findByRole('menuitemradio', { name })
  await act(async () => {
    fireEvent.click(option)
  })
}

describe('ThemeToggle', () => {
  it('starts on System when nothing is stored', () => {
    renderToggle()
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument()
  })

  it('reflects a stored choice', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderToggle()
    expect(await screen.findByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument()
  })

  it('offers all three options with the current one checked', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: /^Theme:/ }))
    const options = await screen.findAllByRole('menuitemradio')
    expect(options.map((o) => o.textContent)).toEqual(['System', 'Light', 'Dark'])
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('picking Dark applies the class and stores the choice', async () => {
    renderToggle()
    await pick('Dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument()
  })

  it('picking Light overrides a dark OS', async () => {
    osDark = true
    document.documentElement.classList.add('dark')
    renderToggle()
    await pick('Light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('picking System clears storage and follows the OS', async () => {
    osDark = true
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderToggle()
    await pick('System')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('never sets a cookie', async () => {
    renderToggle()
    await pick('Dark')
    expect(document.cookie).toBe('')
  })

  it('is labelled in Bangla on /bn', () => {
    renderToggle('bn')
    expect(screen.getByRole('button', { name: 'থিম: সিস্টেম' })).toBeInTheDocument()
  })
})
