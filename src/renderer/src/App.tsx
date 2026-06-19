import { Routes, Route } from 'react-router-dom'
import { ShoppingCart, Factory, TrendingUp, LineChart, Receipt } from 'lucide-react'
import { CompanyProvider } from '@/lib/company-context'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Settings from '@/pages/Settings'
import Inventory from '@/pages/Inventory'
import Products from '@/pages/Products'
import Vendors from '@/pages/Vendors'
import Customers from '@/pages/Customers'
import { ComingSoon } from '@/pages/ComingSoon'

export default function App(): JSX.Element {
  return (
    <CompanyProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/purchase"
            element={
              <ComingSoon
                title="PURCHASE"
                icon={ShoppingCart}
                note="RECORD RAW MATERIAL PURCHASES FROM MULTIPLE VENDORS. EACH PURCHASE CREATES A DATED FIFO STOCK LOT WITH ITS OWN COST AND GST."
              />
            }
          />
          <Route
            path="/production"
            element={
              <ComingSoon
                title="PRODUCTION"
                icon={Factory}
                note="RUN A PRODUCTION BATCH AGAINST A FINISHED PRODUCT'S RECIPE. RAW MATERIALS ARE CONSUMED OLDEST-FIRST (FIFO) AND THE FINISHED GOODS ARE ADDED TO STOCK AT THEIR TRUE COST."
              />
            }
          />
          <Route
            path="/sales"
            element={
              <ComingSoon
                title="SALES"
                icon={TrendingUp}
                note="CREATE GST INVOICES FOR CUSTOMERS. COST OF GOODS SOLD IS PULLED FROM FIFO LOTS SO PROFIT IS ACCURATE PER INVOICE."
              />
            }
          />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/products" element={<Products />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/customers" element={<Customers />} />
          <Route
            path="/profit-loss"
            element={
              <ComingSoon
                title="PROFIT & LOSS"
                icon={LineChart}
                note="SEE GROSS PROFIT (SALES − COST OF GOODS SOLD) AND NET PROFIT AFTER BUSINESS EXPENSES, FOR ANY DATE RANGE."
              />
            }
          />
          <Route
            path="/expenses"
            element={
              <ComingSoon
                title="BUSINESS EXPENSES"
                icon={Receipt}
                note="LOG RUNNING COSTS LIKE RENT, SALARY, ELECTRICITY AND TRANSPORT. THESE FEED INTO NET PROFIT."
              />
            }
          />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </CompanyProvider>
  )
}
