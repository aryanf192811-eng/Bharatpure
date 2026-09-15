import type { LucideIcon } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/auth.store'

export interface WebNavLink {
  label: string
  path: string
  icon: LucideIcon
}

interface WebShellProps {
  links: WebNavLink[]
}

export function WebShell({ links }: WebShellProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-earth-50">
      <header className="flex h-16 items-center justify-between border-b border-earth-200 bg-white px-6">
        <p className="font-display text-lg font-bold text-primary-800">BharatPure</p>
        <div className="flex items-center gap-4">
          <p className="text-sm text-earth-700">{user?.full_name}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-earth-700 transition-shadow hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-earth-200 bg-white p-4 md:block">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2 ${
                    isActive ? 'bg-primary-100 text-primary-800' : 'text-earth-700 hover:bg-earth-100'
                  }`
                }
              >
                <link.icon className="size-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
