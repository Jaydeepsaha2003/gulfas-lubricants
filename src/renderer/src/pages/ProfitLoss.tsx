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

      {/* P&L statement — fixed order: purchases → production → sales → stock → gross → expenses → net */}
      <Card>
        <CardHeader>
          <CardTitle>PROFIT &amp; LOSS STATEMENT</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {[
            { label: 'PURCHASES', hint: `${pnl?.purchases_count ?? 0} VOUCHERS`, value: pnl?.purchases_total ?? 0 },
            { label: 'PRODUCTION COST', hint: `${pnl?.production_count ?? 0} BATCHES`, value: pnl?.production_cost ?? 0 },
            { label: 'SALES', hint: `${pnl?.sales_count ?? 0} INVOICES (NET OF GST)`, value: pnl?.revenue ?? 0 },
            { label: 'STOCK IN HAND', hint: 'CURRENT FIFO VALUE', value: pnl?.stock_in_hand ?? 0 }
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[11px] uppercase text-muted-foreground">{r.hint}</div>
              </div>
              <div className="text-lg font-semibold tabular-nums">{formatMoney(r.value, currency)}</div>
            </div>
          ))}

          {/* Gross profit subtotal */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-semibold text-violet-600">GROSS PROFIT</div>
              <div className="text-[11px] uppercase text-muted-foreground">
                SALES − COGS {formatMoney(pnl?.cogs ?? 0, currency)}
              </div>
            </div>
            <div className="text-lg font-bold tabular-nums text-violet-600">{formatMoney(pnl?.gross_profit ?? 0, currency)}</div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium">BUSINESS EXPENSE</div>
              <div className="text-[11px] uppercase text-muted-foreground">DEDUCTED FROM GROSS PROFIT</div>
            </div>
            <div className="text-lg font-semibold tabular-nums text-amber-600">− {formatMoney(pnl?.expenses ?? 0, currency)}</div>
          </div>

          {/* Net profit total */}
          <div className={cn('flex items-center justify-between py-4', net >= 0 ? 'text-success' : 'text-destructive')}>
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2.5', net >= 0 ? 'bg-success/15' : 'bg-destructive/15')}>
                {net >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
              <div className="text-base font-bold uppercase tracking-wide">NET PROFIT</div>
            </div>
            <div className="text-3xl font-bold tabular-nums">{formatMoney(net, currency)}</div>
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
