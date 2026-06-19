import { useEffect, useMemo, useState } from 'react'
import { Plus, Download, Pencil, Trash2, Search, Check, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Field } from '@/components/common/Field'
import { UpperInput } from '@/components/common/UpperInput'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Party } from '@shared/types'

interface PartyApi {
  nextCode: () => Promise<string>
  list: () => Promise<any[]>
  create: (payload: any) => Promise<any>
  update: (id: number, payload: any) => Promise<any>
  remove: (id: number) => Promise<{ ok: boolean }>
}

interface PartyMasterProps {
  api: PartyApi
  title: string
  noun: string
  icon: LucideIcon
  sheetName: string
}

const emptyForm = (): Omit<Party, 'id' | 'created_at'> => ({
  code: '',
  name: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  state_code: '',
  phone: '',
  email: '',
  is_active: 1
})

export function PartyMaster({ api, title, noun, icon, sheetName }: PartyMasterProps): JSX.Element {
  const [rows, setRows] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null)

  const load = (): void => {
    setLoading(true)
    api
      .list()
      .then((r) => setRows(r as Party[]))
      .catch((e) => toast.error(String(e.message)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase()
    return rows.filter((r) => (term ? r.name.includes(term) || r.code.includes(term) : true))
  }, [rows, q])

  const openNew = async (): Promise<void> => {
    setEditing(null)
    setErrors({})
    let code = ''
    try {
      code = await api.nextCode()
    } catch {
      /* ignore */
    }
    setForm({ ...emptyForm(), code })
    setDialogOpen(true)
  }
  const openEdit = (p: Party): void => {
    setEditing(p)
    setForm({ ...p })
    setErrors({})
    setDialogOpen(true)
  }
  const set = (key: keyof typeof form, value: string | number): void => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: '' }))
  }

  const save = async (): Promise<void> => {
    const errs: Record<string, string> = {}
    if (!String(form.name).trim()) errs.name = 'REQUIRED'
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('PLEASE FILL ALL MANDATORY FIELDS MARKED WITH *')
      return
    }
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim().toUpperCase(),
        gstin: form.gstin.trim().toUpperCase(),
        address: form.address.trim().toUpperCase(),
        city: form.city.trim().toUpperCase(),
        state: form.state.trim().toUpperCase(),
        state_code: String(form.state_code).trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toUpperCase(),
        is_active: form.is_active ? 1 : 0
      }
      if (editing) await api.update(editing.id, payload)
      else await api.create(payload)
      toast.success(editing ? `${noun} UPDATED` : `${noun} ADDED`)
      setDialogOpen(false)
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
      await api.remove(deleteTarget.id)
      toast.success(`${noun} DEACTIVATED`)
      load()
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const exportExcel = async (): Promise<void> => {
    try {
      const res = await window.api.excel.exportRows(
        sheetName,
        `${sheetName.toUpperCase()}.xlsx`,
        [
          { header: 'CODE', key: 'code', width: 16 },
          { header: 'NAME', key: 'name', width: 30 },
          { header: 'GSTIN', key: 'gstin', width: 18 },
          { header: 'ADDRESS', key: 'address', width: 30 },
          { header: 'CITY', key: 'city', width: 16 },
          { header: 'STATE', key: 'state', width: 16 },
          { header: 'STATE_CODE', key: 'state_code', width: 12 },
          { header: 'PHONE', key: 'phone', width: 16 },
          { header: 'EMAIL', key: 'email', width: 24 }
        ],
        filtered
      )
      if (res.saved) toast.success(`${noun} LIST EXPORTED`)
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        icon={icon}
        subtitle={`MANAGE YOUR ${noun}S`}
        actions={
          <>
            <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
              <Download /> EXPORT
            </Button>
            <Button onClick={() => void openNew()}>
              <Plus /> NEW {noun}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-end border-b p-4">
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
                <TableHead>GSTIN</TableHead>
                <TableHead>CITY</TableHead>
                <TableHead>STATE</TableHead>
                <TableHead>PHONE</TableHead>
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
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
                    NO {noun}S YET. CLICK “NEW {noun}”.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className={cn(!p.is_active && 'opacity-50')}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">
                      {p.name}
                      {!p.is_active && (
                        <Badge variant="secondary" className="ml-2">
                          INACTIVE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.gstin || '—'}</TableCell>
                    <TableCell>{p.city || '—'}</TableCell>
                    <TableCell>
                      {p.state || '—'}
                      {p.state_code ? ` (${p.state_code})` : ''}
                    </TableCell>
                    <TableCell>{p.phone || '—'}</TableCell>
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

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `EDIT ${noun}` : `NEW ${noun}`}</DialogTitle>
            <DialogDescription>
              STATE & STATE CODE DRIVE CGST/SGST VS IGST ON {noun === 'VENDOR' ? 'PURCHASES' : 'INVOICES'}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label={`${noun} CODE`} hint="AUTO-GENERATED">
              <Input value={form.code} readOnly disabled className="font-mono" placeholder="AUTO" />
            </Field>
            <Field label="PHONE">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label={`${noun} NAME`} required error={errors.name} className="col-span-2">
              <UpperInput value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <UpperInput value={form.gstin} onChange={(e) => set('gstin', e.target.value)} maxLength={15} />
            </Field>
            <Field label="EMAIL">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value.toUpperCase())}
                className="uppercase placeholder:normal-case"
              />
            </Field>
            <Field label="ADDRESS" className="col-span-2">
              <Textarea
                value={form.address}
                onChange={(e) => set('address', e.target.value.toUpperCase())}
                className="uppercase"
              />
            </Field>
            <Field label="CITY">
              <UpperInput value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="STATE">
                <UpperInput value={form.state} onChange={(e) => set('state', e.target.value)} />
              </Field>
              <Field label="STATE CODE">
                <Input value={form.state_code} onChange={(e) => set('state_code', e.target.value)} maxLength={2} inputMode="numeric" />
              </Field>
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set('is_active', v ? 1 : 0)} />
              <span className="text-sm font-medium">ACTIVE</span>
              <span className="text-xs text-muted-foreground">INACTIVE {noun}S ARE HIDDEN FROM NEW ENTRIES.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={save} disabled={saving}>
              <Check /> {saving ? 'SAVING…' : `SAVE ${noun}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`DEACTIVATE ${deleteTarget?.name ?? ''}?`}
        description={`THIS ${noun} WILL BE HIDDEN FROM NEW ENTRIES BUT KEPT FOR HISTORY. YOU CAN RE-ACTIVATE IT ANYTIME BY EDITING.`}
        confirmLabel="DEACTIVATE"
        destructive
        onConfirm={doDelete}
      />
    </>
  )
}
