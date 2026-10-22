import { Outlet } from 'react-router-dom'
export function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  )
}
