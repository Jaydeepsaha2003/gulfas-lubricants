import { useEffect, useState } from 'react'
import { ShoppingCart, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { TransactionDialog } from '@/components/transactions/TransactionDialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
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
  const [editData, setEditData] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

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

  const openNew = (): void => {
    setEditData(null)
    setOpen(true)
  }

  const openEdit = async (r: any): Promise<void> => {
    try {
      const data = await window.api.purchases.get(r.id)
      setEditData(data)
      setOpen(true)
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const doDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.api.purchases.remove(deleteTarget.id)
      toast.success('PURCHASE DELETED — STOCK REVERSED')
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
        title="PURCHASE"
        icon={ShoppingCart}
        subtitle="BUY RAW MATERIALS FROM VENDORS — CREATES FIFO STOCK"
        actions={
          <Button onClick={openNew} disabled={vendors.filter((v) => v.is_active).length === 0 || products.length === 0}>
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
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
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
                    NO PURCHASES YET. CLICK "NEW PURCHASE".
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditData(null) }}
        mode="PURCHASE"
        parties={vendors}
        products={products}
        onSaved={load}
        editId={editData?.id}
        editData={editData}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="DELETE THIS PURCHASE?"
        description={`VOUCHER ${deleteTarget?.voucher_no ?? ''} WILL BE PERMANENTLY REMOVED. THIS ONLY WORKS IF THE STOCK FROM THIS PURCHASE HAS NOT YET BEEN USED IN PRODUCTION OR SALES.`}
        confirmLabel="DELETE"
        destructive
        onConfirm={doDelete}
      />
    </>
  )
}
