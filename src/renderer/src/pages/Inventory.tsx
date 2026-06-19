import { useEffect, useMemo, useState } from 'react'
import { Boxes, Download, Search, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useCompany } from '@/lib/company-context'
import { cn, formatMoney, formatQty } from '@/lib/utils'
import type { InventoryRow } from '@shared/types'

type Filter = 'ALL' | 'RAW' | 'FINISHED'

const SOURCE_LABEL: Record<string, string> = {
  OPENING: 'OPENING STOCK',
  PURCHASE: 'PURCHASE',
  PRODUCTION: 'PRODUCTION',
  SALE_REVERSAL: 'SALE REVERSAL',
  PROD_REVERSAL: 'PRODUCTION REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT'
}

export default function Inventory(): JSX.Element {
  const { currency } = useCompany()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InventoryRow | null>(null)
  const [lots, setLots] = useState<any[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)

  const openLots = (r: InventoryRow): void => {
    setSelected(r)
    setLots([])
    setLotsLoading(true)
    window.api.inventory
      .lots(r.product_id)
      .then((l) => setLots(l))
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLotsLoading(false))
  }

  const load = (): void => {
    setLoading(true)
    window.api.inventory
      .list()
      .then((r) => setRows(r as InventoryRow[]))
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase()
    return rows
      .filter((r) => (filter === 'ALL' ? true : r.type === filter))
      .filter((r) => (term ? r.name.includes(term) || r.code.includes(term) : true))
  }, [rows, filter, q])

  const totalValue = filtered.reduce((s, r) => s + (r.stock_value || 0), 0)

  const exportExcel = async (): Promise<void> => {
    try {
      const res = await window.api.excel.exportRows(
        'Inventory',
        'INVENTORY.xlsx',
        [
          { header: 'CODE', key: 'code', width: 16 },
          { header: 'NAME', key: 'name', width: 32 },
          { header: 'TYPE', key: 'type', width: 12 },
          { header: 'UNIT', key: 'unit_name', width: 10 },
          { header: 'QTY', key: 'qty', width: 12 },
          { header: 'AVG COST', key: 'avg_cost', width: 14 },
          { header: 'STOCK VALUE', key: 'stock_value', width: 16 }
        ],
        filtered.map((r) => ({
          code: r.code,
          name: r.name,
          type: r.type,
          unit_name: r.unit_name,
          qty: r.qty,
          avg_cost: r.avg_cost,
          stock_value: r.stock_value
        }))
      )
      if (res.saved) toast.success('INVENTORY EXPORTED TO EXCEL')
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const tabs: Filter[] = ['ALL', 'RAW', 'FINISHED']

  return (
    <>
      <PageHeader
        title="STOCK"
        icon={Boxes}
        subtitle="LIVE INVENTORY VALUED AT FIFO COST — CLICK A ROW TO SEE ITS STOCK VOUCHERS"
        actions={
          <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download /> EXPORT EXCEL
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="inline-flex rounded-lg border p-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                    filter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'RAW' ? 'RAW MATERIALS' : t === 'FINISHED' ? 'FINISHED GOODS' : 'ALL'}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="SEARCH CODE OR NAME"
                value={q}
                onChange={(e) => setQ(e.target.value.toUpperCase())}
                className="pl-9 uppercase placeholder:normal-case"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CODE</TableHead>
                <TableHead>NAME</TableHead>
                <TableHead>TYPE</TableHead>
                <TableHead className="text-right">QTY</TableHead>
                <TableHead className="text-right">AVG COST</TableHead>
                <TableHead className="text-right">STOCK VALUE</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    LOADING…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    NO STOCK YET. ADD PRODUCTS AND OPENING STOCK IN PRODUCT MASTER.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const low = r.reorder_level > 0 && r.qty <= r.reorder_level
                  return (
                    <TableRow
                      key={r.product_id}
                      className="cursor-pointer"
                      onClick={() => openLots(r)}
                      title="CLICK TO SEE STOCK SOURCES (VOUCHERS)"
                    >
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant={r.type === 'FINISHED' ? 'default' : 'secondary'}>{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(r.qty)} <span className="text-xs text-muted-foreground">{r.unit_name}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.avg_cost, currency)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(r.stock_value, currency)}
                      </TableCell>
                      <TableCell>
                        {low ? (
                          <Badge variant="warning">LOW</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {filtered.length > 0 && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">TOTAL STOCK VALUE:</span>
              <span className="text-base font-bold">{formatMoney(totalValue, currency)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock sources (FIFO lots) for the clicked product */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <DialogTitle>STOCK SOURCES — {selected?.name}</DialogTitle>
            </div>
            <DialogDescription>
              THE AVAILABLE STOCK ({selected ? formatQty(selected.qty) : 0} {selected?.unit_name}) BROKEN DOWN BY THE VOUCHER
              IT CAME FROM, OLDEST FIRST (FIFO).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead>SOURCE</TableHead>
                  <TableHead>VOUCHER</TableHead>
                  <TableHead>DATE</TableHead>
                  <TableHead className="text-right">AVAILABLE</TableHead>
                  <TableHead className="text-right">UNIT COST</TableHead>
                  <TableHead className="text-right">VALUE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">LOADING…</TableCell>
                  </TableRow>
                ) : lots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      NO STOCK AVAILABLE FOR THIS PRODUCT.
                    </TableCell>
                  </TableRow>
                ) : (
                  lots.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant={l.source_type === 'PURCHASE' ? 'default' : 'secondary'}>
                          {SOURCE_LABEL[l.source_type] || l.source_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.voucher_no || '—'}
                        {l.party_name ? <div className="text-[11px] text-muted-foreground">{l.party_name}</div> : null}
                      </TableCell>
                      <TableCell>{l.lot_date}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(l.qty_remaining)}{' '}
                        <span className="text-xs text-muted-foreground">/ {formatQty(l.qty_in)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(l.unit_cost, currency)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(l.value, currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {lots.length > 0 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">TOTAL AVAILABLE VALUE:</span>
              <span className="text-base font-bold">
                {formatMoney(lots.reduce((s, l) => s + (l.value || 0), 0), currency)}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
