import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
