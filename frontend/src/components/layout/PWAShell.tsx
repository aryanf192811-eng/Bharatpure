import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { Bell, Leaf } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { userApi } from '@/api/user.api'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth.store'

export interface PWATab {
  label: string
  path: string
  icon: LucideIcon
}

interface PWAShellProps {
  title: string
  tabs: PWATab[]
}

function NotificationBell() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => userApi.notifications({ limit: 10 }),
    refetchInterval: 60_000,
  })
  const notifications = data?.data ?? []
  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleOpen = async (id: string, readAt: string | null) => {
    if (readAt) return
    await userApi.markNotificationRead(id)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full p-2 text-earth-700 transition-shadow hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger font-mono text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-earth-500">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n.id, n.read_at)}
                className={`flex w-full flex-col gap-0.5 border-b border-earth-100 p-3 text-left last:border-b-0 hover:bg-earth-50 ${
                  n.read_at ? 'opacity-60' : 'bg-primary-50/40'
                }`}
              >
                <p className="text-sm font-semibold text-earth-900">{n.title}</p>
                <p className="text-xs text-earth-600">{n.body}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-earth-400">
                  {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProfileAvatar({ profilePath }: { profilePath: string }) {
  const user = useAuthStore((s) => s.user)
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : ''

  return (
    <Link
      to={profilePath}
      aria-label="Your profile"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 font-mono text-xs font-bold text-primary-800 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
    >
      {initials || <span className="sr-only">Profile</span>}
    </Link>
  )
}

export function PWAShell({ title, tabs }: PWAShellProps) {
  const profileTab = tabs.find((tab) => tab.label === 'Profile')

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-earth-50">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-gold-400/50 bg-white px-4 shadow-sm">
        <Link to={tabs[0]?.path ?? '/'} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary-800 p-1 text-white">
            <Leaf className="size-4" />
          </div>
          <p className="font-display text-lg font-bold text-primary-800">{title}</p>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          {profileTab && <ProfileAvatar profilePath={profileTab.path} />}
        </div>
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
