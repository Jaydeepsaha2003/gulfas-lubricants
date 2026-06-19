import { Users } from 'lucide-react'
import { PartyMaster } from '@/components/masters/PartyMaster'

export default function Customers(): JSX.Element {
  return (
    <PartyMaster
      api={window.api.customers}
      title="CUSTOMERS"
      noun="CUSTOMER"
      icon={Users}
      sheetName="Customers"
    />
  )
}
