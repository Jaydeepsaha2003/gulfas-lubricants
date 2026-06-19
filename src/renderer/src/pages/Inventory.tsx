import { useEffect, useMemo, useState } from 'react'
import { Boxes, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/lib/company-context'
import { cn, formatMoney, formatQty } from '@/lib/utils'
import type { InventoryRow } from '@shared/types'

type Filter = 'ALL' | 'RAW' | 'FINISHED'

export default function Inventory(): JSX.Element {
  const { currency } = useCompany()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

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
        subtitle="LIVE INVENTORY VALUED AT FIFO COST"
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
                    <TableRow key={r.product_id}>
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
    </>
  )
}
