// Pure, client-safe. English needs singular/plural; the Bangla bundle
// repeats the same word for both forms.

export interface PluralLabel {
  one: string
  other: string
}

export function plural(n: number, label: PluralLabel): string {
  return n === 1 ? label.one : label.other
}
