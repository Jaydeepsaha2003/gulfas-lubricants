import { useCallback, useEffect, useState } from 'react'
import { LineChart as LineChartIcon, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common/Field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/lib/company-context'
import { cn, formatMoney, todayISO } from '@/lib/utils'

const yearStart = (): string => `${new Date().getFullYear()}-01-01`
const monthStart = (): string => todayISO().slice(0, 8) + '01'

export default function ProfitLoss(): JSX.Element {
  const { currency } = useCompany()
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(todayISO())
  const [pnl, setPnl] = useState<any>(null)
  const [monthly, setMonthly] = useState<any[]>([])

  const load = useCallback(() => {
    window.api.reports
      .pnl(from, to)
      .then(setPnl)
      .catch((e) => toast.error(String(e.message)))
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    window.api.reports.monthly().then(setMonthly).catch(() => {})
  }, [])

  const setRange = (f: string, t: string): void => {
    setFrom(f)
    setTo(t)
  }

  const net = pnl?.net_profit ?? 0
  const cards = [
    { label: 'REVENUE (NET OF GST)', value: pnl?.revenue ?? 0, tone: 'text-emerald-600 bg-emerald-600/10' },
    { label: 'COST OF GOODS SOLD', value: pnl?.cogs ?? 0, tone: 'text-blue-600 bg-blue-600/10' },
    { label: 'GROSS PROFIT', value: pnl?.gross_profit ?? 0, tone: 'text-violet-600 bg-violet-600/10' },
    { label: 'BUSINESS EXPENSES', value: pnl?.expenses ?? 0, tone: 'text-amber-600 bg-amber-600/10' }
  ]

  const chartData = monthly.map((m) => ({
    month: m.ym,
    REVENUE: Math.round(m.revenue || 0),
    COGS: Math.round(m.cogs || 0)
  }))

  return (
    <>
      <PageHeader title="PROFIT & LOSS" icon={LineChartIcon} subtitle="REVENUE − COST OF GOODS − EXPENSES" />

      {/* Range controls */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <Field label="FROM" className="w-40">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="TO" className="w-40">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRange(monthStart(), todayISO())}>
              THIS MONTH
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRange(yearStart(), todayISO())}>
              THIS YEAR
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRange('0001-01-01', '9999-12-31')}>
              ALL TIME
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(c.value, currency)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Net profit banner */}
      <Card className={cn('mt-4 border-2', net >= 0 ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
        <CardContent className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-xl p-3', net >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
              {net >= 0 ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">NET PROFIT</div>
              <div className="text-xs text-muted-foreground">
                {pnl?.sales_count ?? 0} SALES · {formatMoney(pnl?.purchases_total ?? 0, currency)} PURCHASED
              </div>
            </div>
          </div>
          <div className={cn('text-3xl font-bold tabular-nums', net >= 0 ? 'text-success' : 'text-destructive')}>
            {formatMoney(net, currency)}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly chart */}
        <Card>
          <CardHeader>
            <CardTitle>MONTHLY REVENUE VS COST</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">NO SALES DATA YET.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 88%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
                  <Legend />
                  <Bar dataKey="REVENUE" fill="hsl(221 83% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="COGS" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>EXPENSES BY CATEGORY</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CATEGORY</TableHead>
                  <TableHead className="text-right">AMOUNT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!pnl?.expense_by_category?.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                      NO EXPENSES IN THIS RANGE.
                    </TableCell>
                  </TableRow>
                ) : (
                  pnl.expense_by_category.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(e.amount, currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
