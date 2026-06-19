import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatMoney(n: number, symbol = '₹'): string {
  const v = Number(n || 0)
  return `${symbol}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatQty(n: number): string {
  const v = Number(n || 0)
  return v.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** Uppercase a string the way the whole app stores text. */
export function upper(v: string): string {
  return (v ?? '').toUpperCase()
}
