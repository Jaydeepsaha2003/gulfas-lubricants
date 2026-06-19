import { useEffect, useState } from 'react'
import { Factory, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Field } from '@/components/common/Field'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/lib/company-context'
import { formatMoney, formatQty, todayISO } from '@/lib/utils'
import type { Product } from '@shared/types'

interface PreviewRow {
  component_name: string
  component_unit: string
  per_batch: number
  required: number
  available: number
  short: boolean
}

export default function Production(): JSX.Element {
  const { currency, company } = useCompany()
  const autoNumber = (company?.doc_numbering ?? 'AUTOMATIC') === 'AUTOMATIC'
  const [rows, setRows] = useState<any[]>([])
  const [finished, setFinished] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  // dialog state
  const [docNo, setDocNo] = useState('')
  const [date, setDate] = useState(todayISO())
  const [productId, setProductId] = useState('')
  const [outputQty, setOutputQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [saving, setSaving] = useState(false)

  const load = (): void => {
    setLoading(true)
    Promise.all([window.api.productions.list(), window.api.products.list('FINISHED')])
      .then(([p, f]) => {
        setRows(p)
        setFinished((f as Product[]).filter((x) => x.is_active))
      })
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (!open) return
    setDate(todayISO())
    setProductId('')
    setOutputQty('1')
    setNotes('')
    setPreview([])
    if (autoNumber) window.api.productions.nextVoucher().then(setDocNo).catch(() => setDocNo(''))
    else setDocNo('')
  }, [open, company])

  useEffect(() => {
    if (!open || !productId) {
      setPreview([])
      return
    }
    window.api.productions
      .preview(Number(productId), Number(outputQty) || 0)
      .then((p) => setPreview(p as PreviewRow[]))
      .catch(() => setPreview([]))
  }, [open, productId, outputQty])

  const anyShort = preview.some((p) => p.short)

  const save = async (): Promise<void> => {
    if (!productId) {
      toast.error('SELECT A FINISHED PRODUCT TO PRODUCE')
      return
    }
    if (!(Number(outputQty) > 0)) {
      toast.error('OUTPUT QUANTITY MUST BE GREATER THAN 0')
      return
    }
    if (!autoNumber && !docNo.trim()) {
      toast.error('PLEASE ENTER A VOUCHER NUMBER')
      return
    }
    setSaving(true)
    try {
      await window.api.productions.create({
        voucher_no: docNo,
        production_date: date,
        product_id: Number(productId),
        output_qty: Number(outputQty),
        notes
      })
      toast.success('PRODUCTION COMPLETE — FINISHED GOODS ADDED TO STOCK')
      setOpen(false)
      load()
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="PRODUCTION"
        icon={Factory}
        subtitle="PRODUCE FINISHED GOODS FROM RECIPES — RAW MATERIALS CONSUMED FIFO"
        actions={
          <Button onClick={() => setOpen(true)} disabled={finished.length === 0}>
            <Plus /> NEW PRODUCTION
          </Button>
        }
      />

      {finished.length === 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm">
            ADD A <b>FINISHED PRODUCT WITH A RECIPE</b> IN PRODUCT MASTER BEFORE RUNNING PRODUCTION.
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
                <TableHead>PRODUCT</TableHead>
                <TableHead className="text-right">OUTPUT QTY</TableHead>
                <TableHead className="text-right">TOTAL COST</TableHead>
                <TableHead className="text-right">UNIT COST</TableHead>
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
                    NO PRODUCTION RUNS YET. CLICK “NEW PRODUCTION”.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.voucher_no}</TableCell>
                    <TableCell>{r.production_date}</TableCell>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatQty(r.output_qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total_input_cost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.unit_cost, currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>NEW PRODUCTION BATCH</DialogTitle>
            <DialogDescription>
              PICK A FINISHED PRODUCT AND HOW MANY TO MAKE. THE RECIPE IS SCALED AND CHECKED AGAINST STOCK.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="VOUCHER NO" required hint={autoNumber ? 'AUTO-GENERATED' : 'ENTER MANUALLY'}>
              <Input
                value={docNo}
                onChange={(e) => setDocNo(e.target.value.toUpperCase())}
                className={`uppercase ${autoNumber ? 'font-mono' : ''}`}
                disabled={autoNumber}
                placeholder={autoNumber ? '' : 'ENTER NUMBER'}
              />
            </Field>
            <Field label="DATE" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="FINISHED PRODUCT" required className="col-span-2">
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="SELECT FINISHED PRODUCT" />
                </SelectTrigger>
                <SelectContent>
                  {finished.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.unit_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="QUANTITY TO PRODUCE" required>
              <Input type="number" min="0" step="0.001" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
            </Field>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-semibold">MATERIALS REQUIRED</div>
            {!productId ? (
              <p className="py-3 text-center text-xs text-muted-foreground">SELECT A PRODUCT TO SEE ITS RECIPE.</p>
            ) : preview.length === 0 ? (
              <p className="py-3 text-center text-xs text-warning-foreground">
                THIS PRODUCT HAS NO RECIPE. ADD ONE IN PRODUCT MASTER.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MATERIAL</TableHead>
                    <TableHead className="text-right">REQUIRED</TableHead>
                    <TableHead className="text-right">IN STOCK</TableHead>
                    <TableHead className="text-right">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.component_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(p.required)} {p.component_unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatQty(p.available)}</TableCell>
                      <TableCell className="text-right">
                        {p.short ? <Badge variant="destructive">SHORT</Badge> : <Badge variant="success">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={save} disabled={saving || !productId || preview.length === 0 || anyShort}>
              <Check /> {saving ? 'PRODUCING…' : anyShort ? 'NOT ENOUGH STOCK' : 'RUN PRODUCTION'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
