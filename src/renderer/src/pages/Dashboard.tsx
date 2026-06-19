import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Boxes,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCompany } from '@/lib/company-context'
import { formatMoney, formatQty } from '@/lib/utils'
import type { InventoryRow } from '@shared/types'

interface Stat {
  label: string
  value: string
  icon: typeof Package
  tone: string
}

export default function Dashboard(): JSX.Element {
  const { company, currency } = useCompany()
  const [inv, setInv] = useState<InventoryRow[]>([])
  const [pnl, setPnl] = useState<any>(null)

  useEffect(() => {
    window.api.inventory
      .list()
      .then((rows) => setInv(rows as InventoryRow[]))
      .catch(() => {})
    const yearStart = `${new Date().getFullYear()}-01-01`
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    window.api.reports
      .pnl(yearStart, today)
      .then(setPnl)
      .catch(() => {})
  }, [])

  const raw = inv.filter((i) => i.type === 'RAW')
  const fin = inv.filter((i) => i.type === 'FINISHED')
  const stockValue = inv.reduce((s, i) => s + (i.stock_value || 0), 0)
  const lowStock = inv.filter((i) => i.reorder_level > 0 && i.qty <= i.reorder_level)

  const stats: Stat[] = [
    { label: 'RAW MATERIALS', value: String(raw.length), icon: Boxes, tone: 'text-blue-600 bg-blue-600/10' },
    { label: 'FINISHED PRODUCTS', value: String(fin.length), icon: Package, tone: 'text-violet-600 bg-violet-600/10' },
    { label: 'STOCK VALUE', value: formatMoney(stockValue, currency), icon: Wallet, tone: 'text-emerald-600 bg-emerald-600/10' },
    { label: 'LOW STOCK ITEMS', value: String(lowStock.length), icon: AlertTriangle, tone: 'text-amber-600 bg-amber-600/10' }
  ]

  const setupDone = {
    company: !!company?.name?.trim(),
    products: inv.length > 0,
    stock: stockValue > 0
  }

  const steps = [
    { done: setupDone.company, label: 'SET UP YOUR COMPANY PROFILE & GST', to: '/settings' },
    { done: setupDone.products, label: 'ADD RAW MATERIALS & FINISHED PRODUCTS', to: '/products' },
    { done: setupDone.stock, label: 'ENTER OPENING STOCK', to: '/products' }
  ]

  return (
    <>
      <PageHeader
        title="DASHBOARD"
        icon={LayoutDashboard}
        subtitle={company?.name ? `WELCOME, ${company.name}` : 'WELCOME — LET’S GET YOU SET UP'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${s.tone}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <div className="truncate text-2xl font-bold">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* This-year financials */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">REVENUE (THIS YEAR)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(pnl?.revenue ?? 0, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">EXPENSES (THIS YEAR)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(pnl?.expenses ?? 0, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">NET PROFIT (THIS YEAR)</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${(pnl?.net_profit ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatMoney(pnl?.net_profit ?? 0, currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Getting started */}
        <Card>
          <CardHeader>
            <CardTitle>GETTING STARTED</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step) => (
              <Link
                key={step.label}
                to={step.to}
                className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                    {step.label}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>LOW STOCK ALERTS</CardTitle>
            {lowStock.length > 0 && <Badge variant="warning">{lowStock.length} ITEMS</Badge>}
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                NO LOW STOCK ITEMS. YOU&rsquo;RE ALL GOOD.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 6).map((i) => (
                  <div key={i.product_id} className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{i.name}</span>
                    <span className="text-muted-foreground">
                      {formatQty(i.qty)} / {formatQty(i.reorder_level)} {i.unit_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
