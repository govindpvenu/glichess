import { Outlet } from "react-router"
import { SiteHeader } from "@/components/site-header"

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
