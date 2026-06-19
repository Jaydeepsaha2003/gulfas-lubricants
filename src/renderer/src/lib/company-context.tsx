import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Company } from '@shared/types'

interface CompanyContextValue {
  company: Company | null
  loading: boolean
  currency: string
  refresh: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  loading: true,
  currency: '₹',
  refresh: async () => {}
})

export function CompanyProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const c = await window.api.settings.get()
      setCompany(c)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const currency = company?.currency_symbol || '₹'

  return (
    <CompanyContext.Provider value={{ company, loading, currency, refresh }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext)
}
