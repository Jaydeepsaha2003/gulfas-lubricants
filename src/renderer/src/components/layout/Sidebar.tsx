import { NavLink } from 'react-router-dom'
import { Droplets } from 'lucide-react'
import { navSections } from '@/lib/nav'
import { useCompany } from '@/lib/company-context'
import { cn } from '@/lib/utils'

export function Sidebar(): JSX.Element {
  const { company } = useCompany()
  const name = company?.name?.trim() || 'GULFAS LUBRICANTS'

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        {company?.logo_data ? (
          <img
            src={company.logo_data}
            alt="LOGO"
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-sidebar-border"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-white">
            <Droplets className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight">{name}</div>
          <div className="text-[11px] uppercase tracking-wider text-sidebar-muted">
            PRODUCTION & SALES
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navSections.map((section, i) => (
          <div key={i} className="space-y-1">
            {section.heading && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-white shadow-sm'
                      : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-muted">
        v0.1.0 · OFFLINE · LOCAL DATA
      </div>
    </aside>
  )
}
