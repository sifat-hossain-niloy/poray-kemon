'use client'

import { useState } from 'react'
import { Share2, MessageCircle, Send, Link as LinkIcon, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStrings } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

interface Props {
  // Path from site root — the button prepends the current origin so the shared
  // link points at production when opened from anywhere.
  path: string
  // Title used for native share sheets and X/Twitter tweet text.
  title: string
  // Optional caption prepended to WhatsApp / native share text.
  text?: string
  // Compact 24x24 icon-only button vs. labeled button.
  variant?: 'icon' | 'labeled'
  // aria-label override.
  ariaLabel?: string
  className?: string
}

// Share button with a dropdown of platform-specific handlers. On mobile
// browsers that expose navigator.share, the primary click opens the native
// share sheet directly (which covers every installed app — Messenger,
// Instagram DM, email — without needing a dedicated per-platform URL).
export function ShareButton({ path, title, text, variant = 'icon', ariaLabel, className }: Props) {
  const strings = useStrings()
  const [copied, setCopied] = useState(false)

  function fullUrl(): string {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      return path.startsWith('http') ? path : `${origin}${path}`
    }
    return path
  }

  async function tryNativeShare(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('share' in navigator)) return false
    try {
      await navigator.share({ title, text, url: fullUrl() })
      return true
    } catch {
      // User cancelled or share failed — fall back to the dropdown.
      return false
    }
  }

  function openWindow(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=520')
  }

  function shareFacebook() {
    const u = encodeURIComponent(fullUrl())
    openWindow(`https://www.facebook.com/sharer/sharer.php?u=${u}`)
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(`${text ? text + ' ' : ''}${fullUrl()}`)
    openWindow(`https://api.whatsapp.com/send?text=${msg}`)
  }

  function shareMessenger() {
    // fb-messenger:// deep link works on mobile with the app installed.
    // On desktop it silently no-ops; Web Share API covers desktop Messenger.
    const u = encodeURIComponent(fullUrl())
    window.location.href = `fb-messenger://share?link=${u}`
  }

  function shareTwitter() {
    const u = encodeURIComponent(fullUrl())
    const t = encodeURIComponent(title)
    openWindow(`https://twitter.com/intent/tweet?url=${u}&text=${t}`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  function onTriggerClick(e: React.MouseEvent) {
    // On mobile browsers with navigator.share, prefer the OS share sheet:
    // it covers every installed app (Messenger, Instagram DM, email) better
    // than our short list can. Prevent the dropdown from opening in that
    // case. On desktop, navigator.share is absent — the dropdown opens as
    // usual, no override.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      e.preventDefault()
      void tryNativeShare()
    }
  }

  const iconSize = variant === 'icon' ? 14 : 16

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={onTriggerClick}
        aria-label={ariaLabel ?? strings.share.label}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'icon'
            ? 'p-1'
            : 'px-2 py-1 text-sm border border-border bg-card hover:bg-muted',
          className,
        )}
      >
        <Share2 size={iconSize} />
        {variant === 'labeled' ? <span>{strings.share.label}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={shareFacebook}>
          <FacebookIcon />
          <span>{strings.share.facebook}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareWhatsApp}>
          <MessageCircle size={14} className="text-[#25D366]" />
          <span>{strings.share.whatsapp}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareMessenger}>
          <Send size={14} className="text-[#0084FF]" />
          <span>{strings.share.messenger}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTwitter}>
          <XIcon />
          <span>{strings.share.twitter}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          {copied ? <Check size={14} className="text-emerald-600" /> : <LinkIcon size={14} />}
          <span>{copied ? strings.share.copied : strings.share.copyLink}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.9 3.77-3.9 1.09 0 2.24.19 2.24.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.45 2.9h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
