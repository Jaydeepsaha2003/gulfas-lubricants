import { Routes, Route } from 'react-router-dom'
import { CompanyProvider } from '@/lib/company-context'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Purchase from '@/pages/Purchase'
import Production from '@/pages/Production'
import Sales from '@/pages/Sales'
import Inventory from '@/pages/Inventory'
import Products from '@/pages/Products'
import Vendors from '@/pages/Vendors'
import Customers from '@/pages/Customers'
import ProfitLoss from '@/pages/ProfitLoss'
import Expenses from '@/pages/Expenses'
import Settings from '@/pages/Settings'

export default function App(): JSX.Element {
  return (
    <CompanyProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/production" element={<Production />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/products" element={<Products />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/profit-loss" element={<ProfitLoss />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </CompanyProvider>
  )
}
