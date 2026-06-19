import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { LayoutDashboard, Wallet, TrendingUp, TrendingDown, Boxes, AlertTriangle, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/common/Field'
import { useCompany } from '@/lib/company-context'
import { cn, formatMoney, formatQty, todayISO } from '@/lib/utils'
import type { InventoryRow } from '@shared/types'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y.slice(2)}`
}
const shortNum = (v: number): string => {
  const n = Number(v)
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(Math.abs(n) % 1000 === 0 ? 0 : 1)}K`
  return String(n)
}
const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
const GRID = 'hsl(214 32% 88%)'

const yearStart = (): string => `${new Date().getFullYear()}-01-01`
const monthStart = (): string => todayISO().slice(0, 8) + '01'
const monthsAgoStart = (n: number): string => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function ChartCard({
  title,
  subtitle,
  empty,
  emptyText,
  children
}: {
  title: string
  subtitle?: string
  empty?: boolean
  emptyText?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            {emptyText || 'NO DATA IN THIS RANGE YET'}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export default function Dashboard(): JSX.Element {
  const { company, currency } = useCompany()
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState<any>(null)
  const [inv, setInv] = useState<InventoryRow[]>([])

  const load = useCallback(() => {
    window.api.reports.dashboard(from, to).then(setData).catch(() => {})
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    window.api.inventory.list().then((r) => setInv(r as InventoryRow[])).catch(() => {})
  }, [])

  const setRange = (f: string, t: string): void => {
    setFrom(f)
    setTo(t)
  }

  const k = data?.kpis ?? { revenue: 0, cogs: 0, gross_profit: 0, expenses: 0, net_profit: 0, sales_count: 0, units_sold: 0 }
  const net = k.net_profit ?? 0

  const monthly = useMemo(
    () =>
      (data?.monthly ?? []).map((m: any) => ({
        month: monthLabel(m.ym),
        REVENUE: Math.round(m.revenue),
        COGS: Math.round(m.cogs),
        EXPENSES: Math.round(m.expenses),
        GROSS: Math.round(m.gross),
        NET: Math.round(m.net)
      })),
    [data]
  )
  const topProducts = useMemo(
    () => (data?.topProducts ?? []).map((p: any) => ({ name: p.name, revenue: Math.round(p.revenue), profit: Math.round(p.profit), qty: p.qty })),
    [data]
  )
  const customers = useMemo(
    () => (data?.salesByCustomer ?? []).map((c: any) => ({ name: c.name, revenue: Math.round(c.revenue) })),
    [data]
  )
  const expenseCats = useMemo(
    () => (data?.expenseByCategory ?? []).map((e: any) => ({ name: e.name, value: Math.round(e.amount) })),
    [data]
  )
  const stockByType = useMemo(
    () => (data?.stockByType ?? []).filter((s: any) => s.value > 0).map((s: any) => ({ name: s.type, value: Math.round(s.value) })),
    [data]
  )

  const lowStock = inv.filter((i) => i.reorder_level > 0 && i.qty <= i.reorder_level)
  const moneyTip = (v: any): string => formatMoney(Number(v) || 0, currency)

  const kpis = [
    { label: 'REVENUE', value: formatMoney(k.revenue, currency), sub: `${k.sales_count} SALES`, tone: 'text-emerald-600 bg-emerald-600/10', icon: TrendingUp },
    { label: 'GROSS PROFIT', value: formatMoney(k.gross_profit, currency), sub: `${formatQty(k.units_sold)} UNITS SOLD`, tone: 'text-violet-600 bg-violet-600/10', icon: Wallet },
    { label: 'EXPENSES', value: formatMoney(k.expenses, currency), sub: 'BUSINESS COSTS', tone: 'text-amber-600 bg-amber-600/10', icon: TrendingDown },
    { label: 'NET PROFIT', value: formatMoney(net, currency), sub: net >= 0 ? 'IN PROFIT' : 'IN LOSS', tone: net >= 0 ? 'text-emerald-600 bg-emerald-600/10' : 'text-destructive bg-destructive/10', icon: net >= 0 ? TrendingUp : TrendingDown }
  ]

  return (
    <>
      <PageHeader
        title="DASHBOARD"
        icon={LayoutDashboard}
        subtitle={company?.name ? `${company.name} — BUSINESS OVERVIEW` : 'BUSINESS OVERVIEW'}
      />

      {/* Date filter */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <Field label="FROM" className="w-40">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="TO" className="w-40">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setRange(monthStart(), todayISO())}>THIS MONTH</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(monthsAgoStart(2), todayISO())}>LAST 3 MONTHS</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(monthsAgoStart(11), todayISO())}>LAST 12 MONTHS</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(yearStart(), todayISO())}>THIS YEAR</Button>
            <Button variant="outline" size="sm" onClick={() => setRange('0001-01-01', '9999-12-31')}>ALL TIME</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${s.tone}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="truncate text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: MoM revenue & profit + revenue/cogs/expenses */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="MONTH-ON-MONTH REVENUE & NET PROFIT" empty={monthly.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={shortNum} width={48} />
              <Tooltip formatter={moneyTip} />
              <Legend />
              <Bar dataKey="REVENUE" name="REVENUE" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
              <Line dataKey="NET" name="NET PROFIT" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="REVENUE vs COST vs EXPENSES (MoM)" empty={monthly.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={shortNum} width={48} />
              <Tooltip formatter={moneyTip} />
              <Legend />
              <Bar dataKey="REVENUE" name="REVENUE" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="COGS" name="COST" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="EXPENSES" name="EXPENSES" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: net profit trend + best sellers */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="NET PROFIT TREND" empty={monthly.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={shortNum} width={48} />
              <Tooltip formatter={moneyTip} />
              <Area dataKey="NET" name="NET PROFIT" stroke="#16a34a" strokeWidth={2.5} fill="url(#netGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="BEST-SELLING PRODUCTS" subtitle="BY REVENUE" empty={topProducts.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={shortNum} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
              <Tooltip formatter={moneyTip} />
              <Bar dataKey="revenue" name="REVENUE" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: expenses pie + stock pie + top customers */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="EXPENSES BY CATEGORY" empty={expenseCats.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expenseCats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={88} paddingAngle={2}>
                {expenseCats.map((_: any, i: number) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={moneyTip} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="STOCK VALUE BY TYPE" subtitle="CURRENT (FIFO)" empty={stockByType.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stockByType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={88} paddingAngle={2}>
                {stockByType.map((_: any, i: number) => (
                  <Cell key={i} fill={i === 0 ? '#2563eb' : '#8b5cf6'} />
                ))}
              </Pie>
              <Tooltip formatter={moneyTip} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TOP CUSTOMERS" subtitle="BY REVENUE" empty={customers.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={customers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={shortNum} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={moneyTip} />
              <Bar dataKey="revenue" name="REVENUE" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Low stock */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-5 w-5 text-primary" /> LOW STOCK ALERTS
          </CardTitle>
          {lowStock.length > 0 ? (
            <Badge variant="warning">{lowStock.length} ITEMS</Badge>
          ) : (
            <Link to="/inventory" className="text-xs text-primary hover:underline">
              VIEW ALL STOCK <ArrowRight className="inline h-3 w-3" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">NO LOW STOCK ITEMS — YOU&rsquo;RE ALL GOOD.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.slice(0, 9).map((i) => (
                <div key={i.product_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="truncate font-medium">{i.name}</span>
                  </div>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {formatQty(i.qty)} / {formatQty(i.reorder_level)} {i.unit_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
