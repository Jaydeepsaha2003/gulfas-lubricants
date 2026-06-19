import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

/**
 * Standard labelled field wrapper.
 * Mandatory fields show a red asterisk (*) as required across the whole app.
 */
export function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  className,
  children
}: FieldProps): JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} className="flex items-center gap-1 text-foreground/80">
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
          {required && (
            <span className="text-destructive" aria-label="required" title="REQUIRED">
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
