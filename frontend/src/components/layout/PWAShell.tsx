import type { LucideIcon } from 'lucide-react'
import { Bell } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export interface PWATab {
  label: string
  path: string
  icon: LucideIcon
}

interface PWAShellProps {
  title: string
  tabs: PWATab[]
}

export function PWAShell({ title, tabs }: PWAShellProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-earth-50">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-earth-200 bg-white px-4">
        <p className="font-display text-lg font-bold text-primary-800">{title}</p>
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-2 text-earth-700 transition-shadow hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <Bell className="size-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex min-h-16 max-w-[480px] items-center justify-around border-t border-earth-200 bg-white pb-safe">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2 ${
                isActive ? 'text-primary-800' : 'text-earth-500'
              }`
            }
          >
            <tab.icon className="size-5" />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
