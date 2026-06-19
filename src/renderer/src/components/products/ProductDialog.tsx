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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/common/Field'
import { UpperInput } from '@/components/common/UpperInput'
import { cn } from '@/lib/utils'
import type { Product, ProductType, Unit } from '@shared/types'

interface RecipeRow {
  component_product_id: string
  quantity: string
}

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  units: Unit[]
  rawMaterials: Product[]
  reloadUnits: () => Promise<void>
  onSaved: () => void
}

interface FormState {
  code: string
  name: string
  type: ProductType
  unit_id: string
  hsn_code: string
  gst_rate: string
  purchase_price: string
  sale_price: string
  reorder_level: string
  recipe_output_qty: string
}

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  type: 'RAW',
  unit_id: '',
  hsn_code: '',
  gst_rate: '18',
  purchase_price: '0',
  sale_price: '0',
  reorder_level: '0',
  recipe_output_qty: '1'
})

export function ProductDialog({
  open,
  onOpenChange,
  product,
  units,
  rawMaterials,
  reloadUnits,
  onSaved
}: ProductDialogProps): JSX.Element {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [recipe, setRecipe] = useState<RecipeRow[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [newUnit, setNewUnit] = useState('')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setNewUnit('')
    if (product) {
      setForm({
        code: product.code,
        name: product.name,
        type: product.type,
        unit_id: String(product.unit_id),
        hsn_code: product.hsn_code,
        gst_rate: String(product.gst_rate),
        purchase_price: String(product.purchase_price),
        sale_price: String(product.sale_price),
        reorder_level: String(product.reorder_level),
        recipe_output_qty: String(product.recipe_output_qty)
      })
      if (product.type === 'FINISHED') {
        window.api.recipes
          .get(product.id)
          .then((lines) =>
            setRecipe(
              lines.map((l: any) => ({
                component_product_id: String(l.component_product_id),
                quantity: String(l.quantity)
              }))
            )
          )
          .catch(() => setRecipe([]))
      } else {
        setRecipe([])
      }
    } else {
      const f = emptyForm()
      f.unit_id = units[0] ? String(units[0].id) : ''
      setForm(f)
      setRecipe([])
    }
  }, [open, product, units])

  const set = (key: keyof FormState, value: string): void => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }))
  }

  const addUnit = async (): Promise<void> => {
    const name = newUnit.trim().toUpperCase()
    if (!name) return
    try {
      const u = await window.api.units.create(name)
      await reloadUnits()
      set('unit_id', String(u.id))
      setNewUnit('')
      toast.success(`UNIT ${name} ADDED`)
    } catch (e: any) {
      toast.error(String(e.message))
    }
  }

  const addRecipeRow = (): void =>
    setRecipe((r) => [...r, { component_product_id: '', quantity: '1' }])
  const removeRecipeRow = (i: number): void => setRecipe((r) => r.filter((_, idx) => idx !== i))
  const setRecipeRow = (i: number, key: keyof RecipeRow, value: string): void =>
    setRecipe((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)))

  const save = async (): Promise<void> => {
    const errs: Record<string, string> = {}
    if (!form.code.trim()) errs.code = 'REQUIRED'
    if (!form.name.trim()) errs.name = 'REQUIRED'
    if (!form.unit_id) errs.unit_id = 'REQUIRED'
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
        type: form.type,
        unit_id: Number(form.unit_id),
        hsn_code: form.hsn_code.trim().toUpperCase(),
        gst_rate: Number(form.gst_rate) || 0,
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        recipe_output_qty: Number(form.recipe_output_qty) || 1,
        is_active: 1
      }
      const saved = product
        ? await window.api.products.update(product.id, payload)
        : await window.api.products.create(payload)

      if (form.type === 'FINISHED') {
        const lines = recipe
          .filter((r) => r.component_product_id && Number(r.quantity) > 0)
          .map((r) => ({
            component_product_id: Number(r.component_product_id),
            quantity: Number(r.quantity)
          }))
        await window.api.recipes.save(saved.id, lines)
      }
      toast.success(product ? 'PRODUCT UPDATED' : 'PRODUCT ADDED')
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(String(e.message))
    } finally {
      setSaving(false)
    }
  }

  const isFinished = form.type === 'FINISHED'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</DialogTitle>
          <DialogDescription>
            RAW MATERIALS ARE PURCHASED. FINISHED PRODUCTS ARE PRODUCED FROM A RECIPE AND SOLD.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="PRODUCT CODE" required error={errors.code}>
            <UpperInput value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="FG-ENGINE-OIL-1L" />
          </Field>
          <Field label="TYPE" required>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RAW">RAW MATERIAL</SelectItem>
                <SelectItem value="FINISHED">FINISHED PRODUCT</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="PRODUCT NAME" required error={errors.name} className="col-span-2">
            <UpperInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ENGINE OIL 1 LITRE BOTTLE" />
          </Field>

          <Field label="UNIT" required error={errors.unit_id}>
            <Select value={form.unit_id} onValueChange={(v) => set('unit_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="SELECT UNIT" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ADD A NEW UNIT" hint="OPTIONAL — TYPE & CLICK +">
            <div className="flex gap-2">
              <UpperInput value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="E.G. DRUM" />
              <Button type="button" variant="outline" size="icon" onClick={addUnit} disabled={!newUnit.trim()}>
                <Plus />
              </Button>
            </div>
          </Field>

          <Field label="HSN / SAC CODE">
            <UpperInput value={form.hsn_code} onChange={(e) => set('hsn_code', e.target.value)} placeholder="2710" maxLength={8} />
          </Field>
          <Field label="GST RATE %">
            <Input type="number" min="0" step="0.01" value={form.gst_rate} onChange={(e) => set('gst_rate', e.target.value)} />
          </Field>

          {!isFinished ? (
            <Field label="PURCHASE PRICE" hint="DEFAULT BUY RATE (PER UNIT)">
              <Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} />
            </Field>
          ) : (
            <Field label="SALE PRICE" hint="DEFAULT SELLING RATE (PER UNIT)">
              <Input type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
            </Field>
          )}
          <Field label="REORDER LEVEL" hint="LOW-STOCK ALERT THRESHOLD">
            <Input type="number" min="0" step="0.01" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} />
          </Field>
        </div>

        {/* Recipe / BOM (finished products only) */}
        {isFinished && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">RECIPE / BILL OF MATERIALS</div>
                <div className="text-xs text-muted-foreground">
                  RAW MATERIALS CONSUMED TO PRODUCE THIS FINISHED PRODUCT
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">OUTPUT QTY</span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.recipe_output_qty}
                  onChange={(e) => set('recipe_output_qty', e.target.value)}
                  className="h-8 w-20"
                />
              </div>
            </div>

            {recipe.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                NO MATERIALS YET. CLICK “ADD MATERIAL” TO BUILD THE RECIPE.
              </p>
            ) : (
              <div className="space-y-2">
                {recipe.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={row.component_product_id}
                        onValueChange={(v) => setRecipeRow(i, 'component_product_id', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="SELECT RAW MATERIAL" />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials.map((rm) => (
                            <SelectItem key={rm.id} value={String(rm.id)}>
                              {rm.name} ({rm.unit_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.quantity}
                      onChange={(e) => setRecipeRow(i, 'quantity', e.target.value)}
                      className="h-8 w-24"
                      placeholder="QTY"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRecipeRow(i)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addRecipeRow}>
              <Plus /> ADD MATERIAL
            </Button>
            {rawMaterials.length === 0 && (
              <p className="mt-2 text-xs text-warning-foreground">
                TIP: ADD SOME RAW MATERIALS FIRST SO YOU CAN PICK THEM HERE.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button onClick={save} disabled={saving} className={cn(saving && 'opacity-70')}>
            <Check /> {saving ? 'SAVING…' : 'SAVE PRODUCT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
