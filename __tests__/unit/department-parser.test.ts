import { describe, it, expect } from 'vitest'
import { parseDepartmentName } from '@/lib/department-parser'

describe('parseDepartmentName', () => {
  it('treats a bare uppercase abbreviation as both short and full', () => {
    expect(parseDepartmentName('CSE')).toEqual({ shortName: 'CSE', nameEn: 'CSE' })
    expect(parseDepartmentName('EEE')).toEqual({ shortName: 'EEE', nameEn: 'EEE' })
  })

  it('normalises dotted abbreviations', () => {
    expect(parseDepartmentName('C.S.E.')).toEqual({ shortName: 'CSE', nameEn: 'CSE' })
  })

  it('treats a long-form sentence as a full name only', () => {
    expect(parseDepartmentName('Computer Science and Engineering')).toEqual({
      shortName: null,
      nameEn: 'Computer Science and Engineering',
    })
  })

  it('splits "ABBR - full name" with hyphen, en-dash, em-dash', () => {
    expect(parseDepartmentName('CSE - Computer Science and Engineering')).toEqual({
      shortName: 'CSE',
      nameEn: 'Computer Science and Engineering',
    })
    expect(parseDepartmentName('CSE – Computer Science and Engineering')).toEqual({
      shortName: 'CSE',
      nameEn: 'Computer Science and Engineering',
    })
    expect(parseDepartmentName('CSE — Computer Science and Engineering')).toEqual({
      shortName: 'CSE',
      nameEn: 'Computer Science and Engineering',
    })
  })

  it('splits "full name (ABBR)" with parens', () => {
    expect(parseDepartmentName('Computer Science and Engineering (CSE)')).toEqual({
      shortName: 'CSE',
      nameEn: 'Computer Science and Engineering',
    })
  })

  it('falls back to full name when the abbreviation side is too long', () => {
    expect(parseDepartmentName('Computer Sci - Engineering')).toEqual({
      shortName: null,
      nameEn: 'Computer Sci - Engineering',
    })
  })

  it('trims input', () => {
    expect(parseDepartmentName('   CSE   ')).toEqual({ shortName: 'CSE', nameEn: 'CSE' })
  })

  it('returns empty result for empty input', () => {
    expect(parseDepartmentName('   ')).toEqual({ shortName: null, nameEn: '' })
  })

  it('caps shortName at 20 characters even after dot-stripping', () => {
    expect(parseDepartmentName('A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U.V')).toEqual({
      shortName: null,
      nameEn: 'A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U.V',
    })
  })

  it('caps nameEn at 200 chars', () => {
    const long = 'X'.repeat(250)
    const out = parseDepartmentName(long)
    expect(out.nameEn).toHaveLength(200)
  })
})
