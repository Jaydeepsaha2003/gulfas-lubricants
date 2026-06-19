import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

/**
 * A searchable single-select dropdown. Behaves like the shadcn Select trigger
 * but opens a filterable list. Data is uppercase across the app, so the search
 * box upper-cases input and matches case-insensitively.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'SELECT',
  searchPlaceholder = 'SEARCH…',
  emptyText = 'NO MATCHES',
  disabled,
  className
}: ComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const term = query.trim().toUpperCase()
    if (!term) return options
    return options.filter((o) => o.label.toUpperCase().includes(term))
  }, [options, query])

  // Reset query + focus the search box each time the popover opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  // Keep the active row clamped inside the filtered list.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  const choose = (v: string): void => {
    onValueChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[active]
      if (opt) choose(opt.value)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <span className={cn('line-clamp-1 text-left', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[12rem]">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            className="flex h-9 w-full bg-transparent py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
          />
        </div>
        <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm outline-none',
                  i === active && 'bg-accent text-accent-foreground'
                )}
              >
                {o.value === value && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <span className="line-clamp-1">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
