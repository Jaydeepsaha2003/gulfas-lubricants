import { useEffect, useMemo, useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field } from '@/components/common/Field'
import { cn, todayISO } from '@/lib/utils'
import type { Product } from '@shared/types'

type StockFilter = 'ALL' | 'RAW' | 'FINISHED'

interface OpeningStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSaved: () => void
}

interface RowState {
  qty: string
  cost: string
}

export function OpeningStockDialog({
  open,
  onOpenChange,
  products,
  onSaved
}: OpeningStockDialogProps): JSX.Element {
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<StockFilter>('ALL')

  useEffect(() => {
    if (!open) return
    const init: Record<number, RowState> = {}
    for (const p of products) init[p.id] = { qty: '', cost: String(p.purchase_price || 0) }
    setRows(init)
    setDate(todayISO())
    setFilter('ALL')
  }, [open, products])

  const visible = useMemo(
    () => products.filter((p) => (filter === 'ALL' ? true : p.type === filter)),
    [products, filter]
  )

  const setRow = (id: number, key: keyof RowState, value: string): void =>
    setRows((r) => ({ ...r, [id]: { ...r[id], [key]: value } }))

  const save = async (): Promise<void> => {
    const payload = products
      .map((p) => ({
        product_id: p.id,
        quantity: Number(rows[p.id]?.qty) || 0,
        unit_cost: Number(rows[p.id]?.cost) || 0,
        as_on_date: date
      }))
      .filter((r) => r.quantity > 0)

    if (payload.length === 0) {
      toast.error('ENTER A QUANTITY FOR AT LEAST ONE PRODUCT')
      return
    }
    setSaving(true)
    try {
      const res = await window.api.openingStock.save(payload)
      toast.success(`OPENING STOCK SAVED FOR ${res.inserted} PRODUCT(S)`)
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <DialogTitle>OPENING STOCK</DialogTitle>
          </div>
          <DialogDescription>
            ENTER THE STOCK YOU ALREADY HAVE ON HAND. EACH ENTRY CREATES A FIFO LOT AT THE COST YOU SET.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="AS ON DATE" required className="max-w-[200px]">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="inline-flex rounded-lg border p-1">
            {(['ALL', 'RAW', 'FINISHED'] as StockFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'RAW' ? 'RAW MATERIALS' : t === 'FINISHED' ? 'FINISHED GOODS' : 'ALL'}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[48vh] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>PRODUCT</TableHead>
                <TableHead>TYPE</TableHead>
                <TableHead className="w-32 text-right">QUANTITY</TableHead>
                <TableHead className="w-36 text-right">UNIT COST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {products.length === 0 ? 'NO PRODUCTS YET. ADD PRODUCTS FIRST.' : 'NO PRODUCTS IN THIS GROUP.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.type === 'FINISHED' ? 'default' : 'secondary'}>{p.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={rows[p.id]?.qty ?? ''}
                        onChange={(e) => setRow(p.id, 'qty', e.target.value)}
                        className="h-8 text-right"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rows[p.id]?.cost ?? ''}
                        onChange={(e) => setRow(p.id, 'cost', e.target.value)}
                        className="h-8 text-right"
                        placeholder="0.00"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button onClick={save} disabled={saving || products.length === 0}>
            {saving ? 'SAVING…' : 'SAVE OPENING STOCK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
