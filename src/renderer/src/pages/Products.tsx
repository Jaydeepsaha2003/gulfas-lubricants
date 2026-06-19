import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Download, Upload, FileSpreadsheet, PackagePlus, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ProductDialog } from '@/components/products/ProductDialog'
import { OpeningStockDialog } from '@/components/products/OpeningStockDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/lib/company-context'
import { cn, formatMoney } from '@/lib/utils'
import type { Product, Unit } from '@shared/types'

type Filter = 'ALL' | 'RAW' | 'FINISHED'

export default function Products(): JSX.Element {
  const { currency } = useCompany()
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const loadProducts = (): void => {
    setLoading(true)
    window.api.products
      .list()
      .then((p) => setProducts(p as Product[]))
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  const loadUnits = async (): Promise<void> => {
    const u = await window.api.units.list()
    setUnits(u as Unit[])
  }
  useEffect(() => {
    loadProducts()
    loadUnits().catch(() => {})
  }, [])

  const rawMaterials = useMemo(() => products.filter((p) => p.type === 'RAW'), [products])

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase()
    return products
      .filter((p) => (filter === 'ALL' ? true : p.type === filter))
      .filter((p) => (term ? p.name.includes(term) || p.code.includes(term) : true))
  }, [products, filter, q])

  const openNew = (): void => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (p: Product): void => {
    setEditing(p)
    setDialogOpen(true)
  }

  const doDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.api.products.remove(deleteTarget.id)
      toast.success('PRODUCT REMOVED')
      loadProducts()
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const handleImport = async (): Promise<void> => {
    try {
      const res = await window.api.excel.importProducts()
      if (res.inserted === 0 && res.updated === 0 && res.skipped === 0 && res.errors.length === 0) return
      const parts: string[] = []
      if (res.inserted) parts.push(`${res.inserted} ADDED`)
      if (res.updated) parts.push(`${res.updated} UPDATED`)
      if (res.skipped) parts.push(`${res.skipped} SKIPPED`)
      toast.success(`IMPORT DONE — ${parts.join(', ') || 'NO CHANGES'}`)
      if (res.errors.length) toast.warning(`${res.errors.length} ROW(S) HAD ISSUES: ${res.errors[0]}`)
      loadProducts()
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const handleExport = async (): Promise<void> => {
    try {
      const res = await window.api.excel.exportProducts()
      if (res.saved) toast.success('PRODUCTS EXPORTED')
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const handleTemplate = async (): Promise<void> => {
    try {
      const res = await window.api.excel.productTemplate()
      if (res.saved) toast.success('TEMPLATE SAVED — FILL IT AND IMPORT')
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const tabs: Filter[] = ['ALL', 'RAW', 'FINISHED']

  return (
    <>
      <PageHeader
        title="PRODUCT MASTER"
        icon={Package}
        subtitle="RAW MATERIALS & FINISHED PRODUCTS WITH RECIPES"
        actions={
          <>
            <Button variant="outline" onClick={handleTemplate}>
              <FileSpreadsheet /> TEMPLATE
            </Button>
            <Button variant="outline" onClick={handleImport}>
              <Upload /> IMPORT
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={products.length === 0}>
              <Download /> EXPORT
            </Button>
            <Button variant="secondary" onClick={() => setOpeningOpen(true)} disabled={products.length === 0}>
              <PackagePlus /> OPENING STOCK
            </Button>
            <Button onClick={openNew}>
              <Plus /> NEW PRODUCT
            </Button>
          </>
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
                <TableHead>UNIT</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">PRICE</TableHead>
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    LOADING…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    NO PRODUCTS YET. CLICK “NEW PRODUCT” OR IMPORT FROM EXCEL.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.type === 'FINISHED' ? 'default' : 'secondary'}>{p.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.unit_name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.hsn_code || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.gst_rate}%</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.type === 'FINISHED' ? p.sale_price : p.purchase_price, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(p)}>
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

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        units={units}
        rawMaterials={rawMaterials}
        reloadUnits={loadUnits}
        onSaved={loadProducts}
      />
      <OpeningStockDialog
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        products={products}
        onSaved={loadProducts}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`REMOVE ${deleteTarget?.name ?? ''}?`}
        description="IF THIS PRODUCT HAS STOCK OR TRANSACTIONS IT WILL BE DEACTIVATED INSTEAD OF DELETED, SO YOUR HISTORY STAYS INTACT."
        confirmLabel="REMOVE"
        destructive
        onConfirm={doDelete}
      />
    </>
  )
}
