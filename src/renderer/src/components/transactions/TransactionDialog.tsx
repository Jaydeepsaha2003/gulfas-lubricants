import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/common/Field'
import { useCompany } from '@/lib/company-context'
import { formatMoney, todayISO } from '@/lib/utils'
import { computeLine, summarize, type LineInput } from '@/lib/gst'
import type { Party, Product } from '@shared/types'

type Mode = 'PURCHASE' | 'SALE'

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  parties: Party[]
  products: Product[]
  onSaved: () => void
  editId?: number
  editData?: any
}

const blankLine = (): LineInput => ({ product_id: '', quantity: '1', rate: '0', gst_rate: '0', uom: 'EACH' })

export function TransactionDialog({
  open,
  onOpenChange,
  mode,
  parties,
  products,
  onSaved,
  editId,
  editData
}: TransactionDialogProps): JSX.Element {
  const { company, currency } = useCompany()
  const [docNo, setDocNo] = useState('')
  const [date, setDate] = useState(todayISO())
  const [partyId, setPartyId] = useState('')
  const [gstMode, setGstMode] = useState(company?.gst_pricing_mode || 'EXCLUSIVE')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineInput[]>([blankLine()])
  const [saving, setSaving] = useState(false)

  const isPurchase = mode === 'PURCHASE'
  const isEdit = !!editId && !!editData

  useEffect(() => {
    if (!open) return
    setGstMode(company?.gst_pricing_mode || 'EXCLUSIVE')

    if (isEdit && editData) {
      // Pre-fill from existing transaction
      setDocNo(isPurchase ? editData.voucher_no : editData.invoice_no)
      setDate(isPurchase ? editData.purchase_date : editData.sale_date)
      setPartyId(String(isPurchase ? editData.vendor_id : editData.customer_id))
      setGstMode(editData.gst_pricing_mode || 'EXCLUSIVE')
      setNotes(editData.notes || '')
      setLines(
        (editData.items || []).map((it: any) => ({
          product_id: String(it.product_id),
          quantity: String(it.quantity),
          rate: String(it.rate),
          gst_rate: String(it.gst_rate),
          uom: it.uom || 'EACH'
        }))
      )
    } else {
      setDate(todayISO())
      setPartyId('')
      setNotes('')
      setLines([blankLine()])
      const autoNumber = (company?.doc_numbering ?? 'AUTOMATIC') === 'AUTOMATIC'
      if (autoNumber) {
        const next = isPurchase ? window.api.purchases.nextVoucher() : window.api.sales.nextInvoice()
        next.then(setDocNo).catch(() => setDocNo(''))
      } else {
        setDocNo('')
      }
    }
  }, [open, editData])

  const autoNumber = (company?.doc_numbering ?? 'AUTOMATIC') === 'AUTOMATIC'
  const party = parties.find((p) => String(p.id) === partyId)
  const interState = !!party?.state_code && party.state_code !== (company?.state_code || '')
  const totals = summarize(lines, gstMode, interState)
  const showUom = !isPurchase
  const gridCls = showUom
    ? 'grid-cols-[1fr_78px_68px_92px_56px_100px_32px]'
    : 'grid-cols-[1fr_90px_110px_80px_120px_40px]'

  const setLine = (i: number, patch: Partial<LineInput>): void =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const onPickProduct = (i: number, productId: string): void => {
    const p = products.find((x) => String(x.id) === productId)
    setLine(i, {
      product_id: Number(productId),
      rate: p ? String(isPurchase ? p.purchase_price : p.sale_price) : '0',
      gst_rate: p ? String(p.gst_rate) : '0',
      uom: 'EACH'
    })
  }

  const onUomChange = (i: number, uom: 'EACH' | 'BOX'): void => {
    const l = lines[i]
    const p = products.find((x) => String(x.id) === String(l.product_id))
    const perUnit = p ? p.sale_price : Number(l.rate) || 0
    const ups = p?.units_per_box || 1
    setLine(i, { uom, rate: String(uom === 'BOX' ? perUnit * ups : perUnit) })
  }

  const save = async (): Promise<void> => {
    if (!partyId) {
      toast.error(`PLEASE SELECT A ${isPurchase ? 'VENDOR' : 'CUSTOMER'}`)
      return
    }
    if (!isEdit && !autoNumber && !docNo.trim()) {
      toast.error(`PLEASE ENTER A ${isPurchase ? 'VOUCHER' : 'INVOICE'} NUMBER`)
      return
    }
    if (isEdit && !docNo.trim()) {
      toast.error(`PLEASE ENTER A ${isPurchase ? 'VOUCHER' : 'INVOICE'} NUMBER`)
      return
    }
    const items = lines
      .filter((l) => l.product_id && Number(l.quantity) > 0)
      .map((l) => ({
        product_id: Number(l.product_id),
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        gst_rate: Number(l.gst_rate),
        uom: l.uom || 'EACH'
      }))
    if (items.length === 0) {
      toast.error('ADD AT LEAST ONE LINE ITEM WITH A QUANTITY')
      return
    }
    setSaving(true)
    try {
      if (isPurchase) {
        const payload = {
          voucher_no: docNo,
          purchase_date: date,
          vendor_id: Number(partyId),
          gst_pricing_mode: gstMode,
          notes,
          items
        }
        if (isEdit) {
          await window.api.purchases.update(editId!, payload)
        } else {
          await window.api.purchases.create(payload)
        }
      } else {
        const payload = {
          invoice_no: docNo,
          sale_date: date,
          customer_id: Number(partyId),
          gst_pricing_mode: gstMode,
          notes,
          items
        }
        if (isEdit) {
          await window.api.sales.update(editId!, payload)
        } else {
          await window.api.sales.create(payload)
        }
      }
      toast.success(
        isPurchase
          ? isEdit ? 'PURCHASE UPDATED — STOCK ADJUSTED' : 'PURCHASE SAVED — STOCK UPDATED'
          : isEdit ? 'SALE UPDATED — STOCK ADJUSTED' : 'SALE SAVED — INVOICE RECORDED'
      )
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? isPurchase ? 'EDIT PURCHASE' : 'EDIT SALE INVOICE'
              : isPurchase ? 'NEW PURCHASE' : 'NEW SALE INVOICE'}
          </DialogTitle>
          <DialogDescription>
            {isPurchase
              ? 'RECORD A PURCHASE — EACH LINE ADDS A DATED FIFO STOCK LOT.'
              : 'CREATE A SALE — COST OF GOODS IS TAKEN FROM OLDEST STOCK (FIFO).'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label={isPurchase ? 'VOUCHER NO' : 'INVOICE NO'} required hint={(!isEdit && autoNumber) ? 'AUTO-GENERATED' : undefined}>
            <Input
              value={docNo}
              onChange={(e) => setDocNo(e.target.value.toUpperCase())}
              className={`uppercase ${(!isEdit && autoNumber) ? 'font-mono' : ''}`}
              disabled={!isEdit && autoNumber}
              placeholder={(!isEdit && autoNumber) ? '' : 'ENTER NUMBER'}
            />
          </Field>
          <Field label="DATE" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={isPurchase ? 'VENDOR' : 'CUSTOMER'} required className="col-span-2">
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger>
                <SelectValue placeholder={`SELECT ${isPurchase ? 'VENDOR' : 'CUSTOMER'}`} />
              </SelectTrigger>
              <SelectContent>
                {parties.filter((p) => p.is_active).length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    NO {isPurchase ? 'VENDORS' : 'CUSTOMERS'} — ADD ONE FIRST
                  </div>
                ) : (
                  parties
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} {p.state_code ? `(${p.state_code})` : ''}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="GST PRICING">
            <Select value={gstMode} onValueChange={(v) => setGstMode(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCLUSIVE">EXCLUSIVE</SelectItem>
                <SelectItem value="INCLUSIVE">INCLUSIVE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="GST TYPE" className="col-span-3">
            <div className="flex h-9 items-center">
              {partyId ? (
                <Badge variant={interState ? 'warning' : 'default'}>
                  {interState ? 'IGST · INTER-STATE' : 'CGST + SGST · INTRA-STATE'}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">SELECT A PARTY TO SEE GST TYPE</span>
              )}
            </div>
          </Field>
        </div>

        {/* Line items */}
        <div className="rounded-lg border">
          <div className={`grid items-center gap-2 border-b bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground ${gridCls}`}>
            <div>PRODUCT</div>
            {showUom && <div>UNIT</div>}
            <div className="text-right">QTY</div>
            <div className="text-right">RATE</div>
            <div className="text-right">GST %</div>
            <div className="text-right">AMOUNT</div>
            <div />
          </div>
          <div className="space-y-2 p-3">
            {lines.map((l, i) => {
              const calc = computeLine(Number(l.quantity) || 0, Number(l.rate) || 0, Number(l.gst_rate) || 0, gstMode, interState)
              const prod = products.find((p) => String(p.id) === String(l.product_id))
              const packSize = prod?.units_per_box || 1
              const boxAvailable = showUom && packSize > 1
              return (
                <div key={i} className={`grid items-center gap-2 ${gridCls}`}>
                  <Select value={l.product_id ? String(l.product_id) : ''} onValueChange={(v) => onPickProduct(i, v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="SELECT PRODUCT" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.unit_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showUom && (
                    <Select value={l.uom || 'EACH'} onValueChange={(v) => onUomChange(i, v as 'EACH' | 'BOX')} disabled={!boxAvailable}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EACH">EACH</SelectItem>
                        {boxAvailable && <SelectItem value="BOX">BOX ×{packSize}</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                  <Input type="number" min="0" step="0.001" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="h-8 text-right" />
                  <Input type="number" min="0" step="0.01" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} className="h-8 text-right" />
                  <Input type="number" min="0" step="0.01" value={l.gst_rate} onChange={(e) => setLine(i, { gst_rate: e.target.value })} className="h-8 text-right" />
                  <div className="text-right text-sm tabular-nums">{formatMoney(calc.total, currency)}</div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              <Plus /> ADD LINE
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">TAXABLE</span>
            <span className="tabular-nums">{formatMoney(totals.taxable, currency)}</span>
          </div>
          {interState ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">IGST</span>
              <span className="tabular-nums">{formatMoney(totals.igst, currency)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST</span>
                <span className="tabular-nums">{formatMoney(totals.cgst, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST</span>
                <span className="tabular-nums">{formatMoney(totals.sgst, currency)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>GRAND TOTAL</span>
            <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button onClick={save} disabled={saving}>
            <Check /> {saving ? 'SAVING…' : isEdit ? (isPurchase ? 'UPDATE PURCHASE' : 'UPDATE INVOICE') : isPurchase ? 'SAVE PURCHASE' : 'SAVE INVOICE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
