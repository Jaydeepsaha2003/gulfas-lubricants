import * as React from 'react'
import { Input, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Text input that forces UPPERCASE as the user types — the app stores all
 * text data in upper case. Use for every text field (names, codes, addresses).
 * For numeric fields use the plain <Input type="number" /> instead.
 */
export const UpperInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, onChange, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        spellCheck={false}
        autoComplete="off"
        className={cn('uppercase placeholder:normal-case', className)}
        onChange={(e) => {
          const start = e.target.selectionStart
          const end = e.target.selectionEnd
          e.target.value = e.target.value.toUpperCase()
          // restore caret position after the in-place transform
          try {
            e.target.setSelectionRange(start, end)
          } catch {
            /* some input types disallow selection range */
          }
          onChange?.(e)
        }}
        {...props}
      />
    )
  }
)
UpperInput.displayName = 'UpperInput'
