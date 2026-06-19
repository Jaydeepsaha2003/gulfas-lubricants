import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Building2, MapPin, Percent, ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Field } from '@/components/common/Field'
import { UpperInput } from '@/components/common/UpperInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/lib/company-context'
import type { Company, GstPricingMode, DocNumberingMode } from '@shared/types'

type Form = Omit<Company, 'id' | 'updated_at'>

const EMPTY: Form = {
  name: '',
  gstin: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  state_code: '',
  pincode: '',
  phone: '',
  email: '',
  logo_data: '',
  gst_pricing_mode: 'EXCLUSIVE',
  doc_numbering: 'AUTOMATIC',
  currency_symbol: '₹',
  invoice_prefix: 'INV',
  financial_year_start: '04-01'
}

const REQUIRED: (keyof Form)[] = ['name', 'address_line1', 'city', 'state', 'state_code', 'phone', 'currency_symbol']

export default function Settings(): JSX.Element {
  const { refresh } = useCompany()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.settings
      .get()
      .then((c: Company) => {
        if (c) setForm({ ...EMPTY, ...c })
      })
      .catch(() => {})
  }, [])

  const set = <K extends keyof Form>(key: K, value: Form[K]): void => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_500_000) {
      toast.error('LOGO TOO LARGE — PLEASE USE AN IMAGE UNDER 1.5 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logo_data', String(reader.result))
    reader.readAsDataURL(file)
  }

  const save = async (): Promise<void> => {
    const errs: Partial<Record<keyof Form, string>> = {}
    for (const key of REQUIRED) {
      if (!String(form[key] ?? '').trim()) errs[key] = 'REQUIRED'
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('PLEASE FILL ALL MANDATORY FIELDS MARKED WITH *')
      return
    }
    setSaving(true)
    try {
      await window.api.settings.save(form)
      await refresh()
      toast.success('SETTINGS SAVED')
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="SETTINGS"
        icon={SettingsIcon}
        subtitle="MANAGE YOUR COMPANY, GST AND BRANDING"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save /> {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company profile */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>COMPANY PROFILE</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="COMPANY NAME" required error={errors.name} className="col-span-2">
              <UpperInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="GULFAS LUBRICANTS" />
            </Field>
            <Field label="GSTIN" hint="15-CHARACTER GST NUMBER">
              <UpperInput value={form.gstin} onChange={(e) => set('gstin', e.target.value)} maxLength={15} placeholder="22AAAAA0000A1Z5" />
            </Field>
            <Field label="PHONE" required error={errors.phone}>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" inputMode="tel" />
            </Field>
            <Field label="EMAIL" className="col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value.toUpperCase())}
                className="uppercase placeholder:normal-case"
                placeholder="SALES@GULFAS.COM"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>ADDRESS</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="ADDRESS LINE 1" required error={errors.address_line1} className="col-span-2">
              <UpperInput value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} />
            </Field>
            <Field label="ADDRESS LINE 2" className="col-span-2">
              <UpperInput value={form.address_line2} onChange={(e) => set('address_line2', e.target.value)} />
            </Field>
            <Field label="CITY" required error={errors.city}>
              <UpperInput value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="PINCODE">
              <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" maxLength={6} />
            </Field>
            <Field label="STATE" required error={errors.state}>
              <UpperInput value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="MAHARASHTRA" />
            </Field>
            <Field label="STATE CODE" required error={errors.state_code} hint="GST STATE CODE, E.G. 27">
              <Input value={form.state_code} onChange={(e) => set('state_code', e.target.value)} maxLength={2} inputMode="numeric" />
            </Field>
          </CardContent>
        </Card>

        {/* GST & pricing */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Percent className="h-5 w-5 text-primary" />
            <CardTitle>GST & PRICING</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field
              label="GST PRICING MODE"
              required
              className="col-span-2"
              hint={
                form.gst_pricing_mode === 'INCLUSIVE'
                  ? 'PRICES YOU ENTER ALREADY INCLUDE GST — TAX IS BACKED OUT OF THE PRICE.'
                  : 'GST IS ADDED ON TOP OF THE PRICES YOU ENTER.'
              }
            >
              <Select
                value={form.gst_pricing_mode}
                onValueChange={(v) => set('gst_pricing_mode', v as GstPricingMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCLUSIVE">EXCLUSIVE — GST ADDED ON TOP</SelectItem>
                  <SelectItem value="INCLUSIVE">INCLUSIVE — PRICE INCLUDES GST</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="CURRENCY SYMBOL" required error={errors.currency_symbol}>
              <Input value={form.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} maxLength={3} />
            </Field>
            <Field label="INVOICE PREFIX">
              <UpperInput value={form.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value)} placeholder="INV" />
            </Field>
            <Field label="FINANCIAL YEAR START" hint="FORMAT MM-DD (INDIA: 04-01)">
              <Input value={form.financial_year_start} onChange={(e) => set('financial_year_start', e.target.value)} placeholder="04-01" />
            </Field>
            <Field
              label="DOCUMENT NUMBERING"
              required
              className="col-span-2"
              hint={
                form.doc_numbering === 'AUTOMATIC'
                  ? 'INVOICE / VOUCHER NUMBERS ARE GENERATED FOR YOU AND LOCKED.'
                  : 'YOU TYPE EACH INVOICE / VOUCHER NUMBER YOURSELF.'
              }
            >
              <Select value={form.doc_numbering} onValueChange={(v) => set('doc_numbering', v as DocNumberingMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTOMATIC">AUTOMATIC — GENERATE NUMBERS</SelectItem>
                  <SelectItem value="MANUAL">MANUAL — I WILL TYPE NUMBERS</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle>BRANDING / LOGO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                {form.logo_data ? (
                  <img src={form.logo_data} alt="LOGO" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  UPLOAD A SQUARE LOGO (PNG / JPG, UNDER 1.5 MB). IT APPEARS IN THE SIDEBAR AND ON INVOICES.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <label className="cursor-pointer">
                      CHOOSE IMAGE
                      <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                    </label>
                  </Button>
                  {form.logo_data && (
                    <Button variant="ghost" onClick={() => set('logo_data', '')}>
                      <Trash2 /> REMOVE
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ALL DATA IS STORED LOCALLY ON THIS COMPUTER. FIELDS MARKED <span className="text-destructive">*</span> ARE MANDATORY.
      </p>
    </>
  )
}
