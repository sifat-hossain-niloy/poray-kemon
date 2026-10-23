'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStrings } from '@/lib/i18n/client'
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  parseThemePreference,
  readStoredThemePreference,
  resolveTheme,
  storeThemePreference,
  systemPrefersDark,
  type ThemePreference,
} from '@/lib/theme'

// Only set when localStorage refused the write, so the choice still sticks
// for this page view.
let memoryPreference: ThemePreference | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    memoryPreference = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): ThemePreference {
  return memoryPreference ?? readStoredThemePreference()
}

function getServerSnapshot(): ThemePreference {
  return 'system'
}

function setPreference(preference: ThemePreference) {
  memoryPreference = storeThemePreference(preference) ? null : preference
  applyResolvedTheme(resolveTheme(preference, systemPrefersDark()))
  listeners.forEach((listener) => listener())
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemeToggle() {
  const strings = useStrings()
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const Icon = ICONS[preference]
  const labels: Record<ThemePreference, string> = {
    system: strings.nav.themeSystem,
    light: strings.nav.themeLight,
    dark: strings.nav.themeDark,
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`${strings.nav.theme}: ${labels[preference]}`}
            title={strings.nav.theme}
          >
            <Icon aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{strings.nav.theme}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(value) => setPreference(parseThemePreference(value))}
          >
            {(['system', 'light', 'dark'] as const).map((option) => {
              const OptionIcon = ICONS[option]
              return (
                <DropdownMenuRadioItem key={option} value={option}>
                  <OptionIcon aria-hidden />
                  {labels[option]}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
