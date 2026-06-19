import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { TransactionDialog } from '@/components/transactions/TransactionDialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common/Field'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/lib/company-context'
import { formatMoney } from '@/lib/utils'
import type { Party, Product } from '@shared/types'

export default function Sales(): JSX.Element {
  const { currency } = useCompany()
  const [rows, setRows] = useState<any[]>([])
  const [customers, setCustomers] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editData, setEditData] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = (): void => {
    setLoading(true)
    Promise.all([window.api.sales.list(), window.api.customers.list(), window.api.products.list('FINISHED')])
      .then(([s, c, pr]) => {
        setRows(s)
        setCustomers(c as Party[])
        setProducts((pr as Product[]).filter((x) => x.is_active))
      })
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase()
    return rows.filter((r) => {
      if (from && r.sale_date < from) return false
      if (to && r.sale_date > to) return false
      if (term) {
        const hay = `${r.invoice_no ?? ''} ${r.customer_name ?? ''} ${r.items_text ?? ''}`.toUpperCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [rows, q, from, to])

  const hasFilters = !!(q || from || to)
  const clearFilters = (): void => {
    setQ('')
    setFrom('')
    setTo('')
  }

  const canSell = customers.filter((c) => c.is_active).length > 0 && products.length > 0

  const openNew = (): void => {
    setEditData(null)
    setOpen(true)
  }

  const openEdit = async (r: any): Promise<void> => {
    try {
      const data = await window.api.sales.get(r.id)
      setEditData(data)
      setOpen(true)
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const doDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.api.sales.remove(deleteTarget.id)
      toast.success('SALE DELETED — STOCK RESTORED')
      load()
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <PageHeader
        title="SALES"
        icon={TrendingUp}
        subtitle="SELL FINISHED GOODS — FIFO COST & GST APPLIED"
        actions={
          <Button onClick={openNew} disabled={!canSell}>
            <Plus /> NEW SALE
          </Button>
        }
      />

      {!canSell && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm">
            ADD AT LEAST ONE <b>CUSTOMER</b> AND ONE <b>PRODUCT</b> (WITH STOCK) BEFORE RECORDING A SALE.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-3 border-b p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="SEARCH BY INVOICE, CUSTOMER OR ITEM"
                value={q}
                onChange={(e) => setQ(e.target.value.toUpperCase())}
                className="pl-9 uppercase placeholder:normal-case"
              />
            </div>
            <Field label="FROM" className="w-40">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="TO" className="w-40">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X /> CLEAR
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>INVOICE</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>CUSTOMER</TableHead>
                <TableHead>ITEMS</TableHead>
                <TableHead className="text-right">TAXABLE</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">GRAND TOTAL</TableHead>
                <TableHead className="text-right">PROFIT</TableHead>
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">LOADING…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    {rows.length === 0 ? 'NO SALES YET. CLICK "NEW SALE".' : 'NO SALES MATCH YOUR FILTERS.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const profit = r.taxable_total - r.cogs
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                      <TableCell>{r.sale_date}</TableCell>
                      <TableCell className="font-medium">{r.customer_name}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.items_text || ''}>
                        {r.items_text || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.taxable_total, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.cgst + r.sgst + r.igst, currency)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.grand_total, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={profit >= 0 ? 'success' : 'destructive'}>{formatMoney(profit, currency)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(r)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditData(null) }}
        mode="SALE"
        parties={customers}
        products={products}
        onSaved={load}
        editId={editData?.id}
        editData={editData}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="DELETE THIS SALE?"
        description={`INVOICE ${deleteTarget?.invoice_no ?? ''} WILL BE PERMANENTLY REMOVED AND THE STOCK WILL BE RESTORED AT THE ORIGINAL FIFO COST.`}
        confirmLabel="DELETE"
        destructive
        onConfirm={doDelete}
      />
    </>
  )
}
