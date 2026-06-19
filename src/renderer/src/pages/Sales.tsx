import { useEffect, useState } from 'react'
import { TrendingUp, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { TransactionDialog } from '@/components/transactions/TransactionDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

  const load = (): void => {
    setLoading(true)
    Promise.all([window.api.sales.list(), window.api.customers.list(), window.api.products.list()])
      .then(([s, c, pr]) => {
        setRows(s)
        setCustomers(c as Party[])
        setProducts((pr as Product[]).filter((x) => x.is_active))
      })
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const canSell = customers.filter((c) => c.is_active).length > 0 && products.length > 0

  return (
    <>
      <PageHeader
        title="SALES"
        icon={TrendingUp}
        subtitle="SELL FINISHED GOODS — FIFO COST & GST APPLIED"
        actions={
          <Button onClick={() => setOpen(true)} disabled={!canSell}>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>INVOICE</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>CUSTOMER</TableHead>
                <TableHead className="text-right">TAXABLE</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">GRAND TOTAL</TableHead>
                <TableHead className="text-right">PROFIT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">LOADING…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    NO SALES YET. CLICK “NEW SALE”.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const profit = r.taxable_total - r.cogs
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                      <TableCell>{r.sale_date}</TableCell>
                      <TableCell className="font-medium">{r.customer_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.taxable_total, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.cgst + r.sgst + r.igst, currency)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.grand_total, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={profit >= 0 ? 'success' : 'destructive'}>{formatMoney(profit, currency)}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} mode="SALE" parties={customers} products={products} onSaved={load} />
    </>
  )
}
