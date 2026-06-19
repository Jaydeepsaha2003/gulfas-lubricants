import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  TrendingUp,
  Boxes,
  Package,
  Truck,
  Users,
  LineChart,
  Receipt,
  Settings,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export interface NavSection {
  heading?: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  { items: [{ label: 'DASHBOARD', path: '/', icon: LayoutDashboard }] },
  {
    heading: 'OPERATIONS',
    items: [
      { label: 'PURCHASE', path: '/purchase', icon: ShoppingCart },
      { label: 'PRODUCTION', path: '/production', icon: Factory },
      { label: 'SALES', path: '/sales', icon: TrendingUp }
    ]
  },
  {
    heading: 'INVENTORY',
    items: [{ label: 'STOCK', path: '/inventory', icon: Boxes }]
  },
  {
    heading: 'MASTERS',
    items: [
      { label: 'PRODUCT MASTER', path: '/products', icon: Package },
      { label: 'VENDORS', path: '/vendors', icon: Truck },
      { label: 'CUSTOMERS', path: '/customers', icon: Users }
    ]
  },
  {
    heading: 'REPORTS',
    items: [
      { label: 'PROFIT & LOSS', path: '/profit-loss', icon: LineChart },
      { label: 'BUSINESS EXPENSES', path: '/expenses', icon: Receipt }
    ]
  },
  {
    heading: 'SYSTEM',
    items: [{ label: 'SETTINGS', path: '/settings', icon: Settings }]
  }
]
