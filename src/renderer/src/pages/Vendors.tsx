import { Truck } from 'lucide-react'
import { PartyMaster } from '@/components/masters/PartyMaster'

export default function Vendors(): JSX.Element {
  return (
    <PartyMaster
      api={window.api.vendors}
      title="VENDORS"
      noun="VENDOR"
      icon={Truck}
      sheetName="Vendors"
    />
  )
}
