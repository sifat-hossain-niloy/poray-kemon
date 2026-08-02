// Small helper that emits a schema.org BreadcrumbList given a list of
// {name, path} entries. Google renders this as the breadcrumb trail on
// the SERP tile above the title, which lifts click-through on nested
// pages (e.g. "poraykemon.com > Universities > BUET > CSE").

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

export interface Crumb {
  name: string
  path: string
}

export function breadcrumbJsonLd(locale: 'en' | 'bn', crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: c.name,
      item: `${SITE_URL}/${locale}${c.path === '/' ? '' : c.path}`,
    })),
  }
}
