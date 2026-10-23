import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BN } from '@/lib/i18n/strings-bn'

const session = vi.hoisted(() => ({ status: 'authenticated' as string }))
const signIn = vi.hoisted(() => vi.fn())
const signOut = vi.hoisted(() => vi.fn())

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: session.status }),
  signIn,
  signOut,
}))

import { DeleteAccountSection } from '@/components/account/DeleteAccountSection'
import { LocaleProvider } from '@/lib/i18n/client'

const s = BN.account
const fetchMock = vi.fn()

beforeEach(() => {
  session.status = 'authenticated'
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function renderSection() {
  return render(
    <LocaleProvider locale="bn">
      <DeleteAccountSection returnTo="/bn/privacy#delete-account" />
    </LocaleProvider>,
  )
}

function openConfirm() {
  fireEvent.click(screen.getByRole('button', { name: s.deleteButton }))
}

describe('DeleteAccountSection', () => {
  it('asks a signed-out visitor to sign in and offers no delete button', () => {
    session.status = 'unauthenticated'
    renderSection()
    expect(screen.getByText(s.signInToDelete)).toBeTruthy()
    expect(screen.queryByRole('button', { name: s.deleteButton })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: BN.auth.signInWithGoogle }))
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/bn/privacy#delete-account' })
  })

  it('spells out the consequences and keeps the final button disabled until acknowledged', () => {
    renderSection()
    openConfirm()

    expect(screen.getByText(s.confirmRemoved)).toBeTruthy()
    expect(screen.getByText(s.confirmKept)).toBeTruthy()
    expect(screen.getByText(s.confirmNoRereview)).toBeTruthy()

    const confirm = screen.getByRole('button', { name: s.confirmButton })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm.hasAttribute('disabled')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends DELETE /api/me with an explicit confirmation, then signs out', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }))
    renderSection()
    openConfirm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: s.confirmButton }))

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/bn' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    expect(screen.getByText(s.deleted)).toBeTruthy()
  })

  it('shows the server error and stays signed in when deletion fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: s.unavailable }), { status: 503 }),
    )
    renderSection()
    openConfirm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: s.confirmButton }))

    expect((await screen.findByRole('alert')).textContent).toBe(s.unavailable)
    expect(signOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: s.cancel }))
    expect(screen.getByRole('button', { name: s.deleteButton })).toBeTruthy()
  })
})
