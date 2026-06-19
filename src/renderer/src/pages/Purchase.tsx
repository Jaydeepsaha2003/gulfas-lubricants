import { useEffect, useState } from 'react'
import { ShoppingCart, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { TransactionDialog } from '@/components/transactions/TransactionDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/lib/company-context'
import { formatMoney } from '@/lib/utils'
import type { Party, Product } from '@shared/types'

export default function Purchase(): JSX.Element {
  const { currency } = useCompany()
  const [rows, setRows] = useState<any[]>([])
  const [vendors, setVendors] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = (): void => {
    setLoading(true)
    Promise.all([window.api.purchases.list(), window.api.vendors.list(), window.api.products.list()])
      .then(([p, v, pr]) => {
        setRows(p)
        setVendors(v as Party[])
        setProducts((pr as Product[]).filter((x) => x.is_active))
      })
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <>
      <PageHeader
        title="PURCHASE"
        icon={ShoppingCart}
        subtitle="BUY RAW MATERIALS FROM VENDORS — CREATES FIFO STOCK"
        actions={
          <Button onClick={() => setOpen(true)} disabled={vendors.filter((v) => v.is_active).length === 0 || products.length === 0}>
            <Plus /> NEW PURCHASE
          </Button>
        }
      />

      {(vendors.filter((v) => v.is_active).length === 0 || products.length === 0) && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm">
            ADD AT LEAST ONE <b>VENDOR</b> AND ONE <b>PRODUCT</b> BEFORE RECORDING A PURCHASE.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VOUCHER</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>VENDOR</TableHead>
                <TableHead className="text-right">TAXABLE</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">GRAND TOTAL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">LOADING…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    NO PURCHASES YET. CLICK “NEW PURCHASE”.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.voucher_no}</TableCell>
                    <TableCell>{r.purchase_date}</TableCell>
                    <TableCell className="font-medium">{r.vendor_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.taxable_total, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.cgst + r.sgst + r.igst, currency)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.grand_total, currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} mode="PURCHASE" parties={vendors} products={products} onSaved={load} />
    </>
  )
}
