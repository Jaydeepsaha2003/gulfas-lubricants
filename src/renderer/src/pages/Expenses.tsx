import { useEffect, useState } from 'react'
import { Receipt, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Field } from '@/components/common/Field'
import { UpperInput } from '@/components/common/UpperInput'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/lib/company-context'
import { formatMoney, todayISO } from '@/lib/utils'

export default function Expenses(): JSX.Element {
  const { currency, company } = useCompany()
  const autoNumber = (company?.doc_numbering ?? 'AUTOMATIC') === 'AUTOMATIC'
  const [rows, setRows] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const [docNo, setDocNo] = useState('')
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  const load = (): void => {
    setLoading(true)
    Promise.all([window.api.expenses.list(), window.api.expenses.categories()])
      .then(([e, c]) => {
        setRows(e)
        setCategories(c)
      })
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = (): void => {
    setIsEdit(false)
    setEditId(null)
    setDate(todayISO())
    setCategoryId('')
    setDescription('')
    setAmount('')
    setNewCat('')
    if (autoNumber) window.api.expenses.nextVoucher().then(setDocNo).catch(() => setDocNo(''))
    else setDocNo('')
    setOpen(true)
  }

  const openEdit = (r: any): void => {
    setIsEdit(true)
    setEditId(r.id)
    setDocNo(r.voucher_no)
    setDate(r.expense_date)
    setCategoryId(r.category_id ? String(r.category_id) : '')
    setDescription(r.description || '')
    setAmount(String(r.amount))
    setNewCat('')
    setOpen(true)
  }

  const addCategory = async (): Promise<void> => {
    const name = newCat.trim().toUpperCase()
    if (!name) return
    try {
      const c = await window.api.expenses.createCategory(name)
      const cats = await window.api.expenses.categories()
      setCategories(cats)
      setCategoryId(String(c.id))
      setNewCat('')
      toast.success(`CATEGORY ${name} ADDED`)
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const doSave = async (): Promise<void> => {
    if (!(Number(amount) > 0)) {
      toast.error('ENTER AN AMOUNT GREATER THAN 0')
      return
    }
    if (!docNo.trim()) {
      toast.error('PLEASE ENTER A VOUCHER NUMBER')
      return
    }
    setSaving(true)
    try {
      const payload = {
        voucher_no: docNo,
        expense_date: date,
        category_id: categoryId ? Number(categoryId) : null,
        description,
        amount: Number(amount)
      }
      if (isEdit && editId) {
        await window.api.expenses.update(editId, payload)
        toast.success('EXPENSE UPDATED')
      } else {
        await window.api.expenses.create(payload)
        toast.success('EXPENSE SAVED')
      }
      setOpen(false)
      load()
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.api.expenses.remove(deleteTarget.id)
      toast.success('EXPENSE DELETED')
      load()
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setDeleteTarget(null)
    }
  }

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0)

  return (
    <>
      <PageHeader
        title="BUSINESS EXPENSES"
        icon={Receipt}
        subtitle="RUNNING COSTS THAT REDUCE NET PROFIT"
        actions={
          <Button onClick={openNew}>
            <Plus /> NEW EXPENSE
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VOUCHER</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>CATEGORY</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead className="text-right">AMOUNT</TableHead>
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
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
                    NO EXPENSES YET. CLICK "NEW EXPENSE".
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.voucher_no}</TableCell>
                    <TableCell>{r.expense_date}</TableCell>
                    <TableCell>{r.category_name || '—'}</TableCell>
                    <TableCell className="font-medium">{r.description || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount, currency)}</TableCell>
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
          {rows.length > 0 && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">TOTAL EXPENSES:</span>
              <span className="text-base font-bold">{formatMoney(total, currency)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'EDIT EXPENSE' : 'NEW EXPENSE'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="VOUCHER NO" required hint={!isEdit && autoNumber ? 'AUTO-GENERATED' : undefined}>
              <Input
                value={docNo}
                onChange={(e) => setDocNo(e.target.value.toUpperCase())}
                className={`uppercase ${!isEdit && autoNumber ? 'font-mono' : ''}`}
                disabled={!isEdit && autoNumber}
                placeholder={(!isEdit && autoNumber) ? '' : 'ENTER NUMBER'}
              />
            </Field>
            <Field label="DATE" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="CATEGORY" className="col-span-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="SELECT CATEGORY" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ADD A NEW CATEGORY" hint="OPTIONAL" className="col-span-2">
              <div className="flex gap-2">
                <UpperInput value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="E.G. INTERNET" />
                <Button type="button" variant="outline" size="icon" onClick={addCategory} disabled={!newCat.trim()}>
                  <Plus />
                </Button>
              </div>
            </Field>
            <Field label="DESCRIPTION" className="col-span-2">
              <UpperInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="E.G. JUNE OFFICE RENT" />
            </Field>
            <Field label="AMOUNT" required className="col-span-2">
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={doSave} disabled={saving}>
              <Check /> {saving ? 'SAVING…' : isEdit ? 'UPDATE EXPENSE' : 'SAVE EXPENSE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="DELETE THIS EXPENSE?"
        description="THIS PERMANENTLY REMOVES THE EXPENSE ENTRY."
        confirmLabel="DELETE"
        destructive
        onConfirm={doDelete}
      />
    </>
  )
}
