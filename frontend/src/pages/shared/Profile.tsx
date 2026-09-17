import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, LogOut, MessageCircle, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { authApi } from '@/api/auth.api'
import { userApi } from '@/api/user.api'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth.store'

// Answers describe real platform behavior only -- same "no overclaiming" discipline as
// everywhere else (e.g. credit eligibility is explicitly framed as indicative, not a loan).
const FAQ_ITEMS = [
  {
    q: 'How is my Trust Score calculated?',
    a: 'From your fulfillment rate, quality consistency, on-time delivery, and dispute rate, recomputed nightly after each batch’s outcome is known. See the full breakdown on your Trust Score page.',
  },
  {
    q: 'What does the AI-recommended price mean?',
    a: 'It’s a fair-price range computed from the current commodity rate, your batch’s quality grade, and live demand — you always choose your own listing price, this is guidance only.',
  },
  {
    q: 'When do I get paid after a sale?',
    a: 'Funds are held in escrow when a buyer orders, then released to you once delivery is confirmed — check a batch’s Batch Identity Record timeline for the exact release event.',
  },
  {
    q: 'Is the Micro-Credit Eligibility score a loan offer?',
    a: 'No — it’s an indicative signal for lending partners based on your trust score and transaction history, not a loan offer or a guaranteed credit line.',
  },
  {
    q: 'Why did my batch fail quality testing?',
    a: 'Check the Quality Test Results section on the batch page for the specific parameters tested. A failed Tier-1 rapid test can be challenged with a NABL B-sample referee lab review.',
  },
]

export default function Profile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { data, isLoading } = useQuery({ queryKey: ['users', 'me'], queryFn: userApi.me })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
      toast.success('Signed out.')
    },
  })

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const profile = data.data

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-4">
      <div className="flex flex-col items-center gap-2 rounded-md bg-white p-6 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-800 text-white">
          <User className="size-7" />
        </div>
        <p className="font-display text-lg font-bold text-earth-900">{profile.full_name}</p>
        <p className="text-sm text-earth-500">{profile.role}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="text-earth-500">Phone</span>
          <span className="font-medium text-earth-900">{profile.phone}</span>
        </div>
        {profile.email && (
          <div className="flex justify-between text-sm">
            <span className="text-earth-500">Email</span>
            <span className="font-medium text-earth-900">{profile.email}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-earth-500">Status</span>
          <span className="font-medium capitalize text-earth-900">{profile.status}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4 shadow-md">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="size-4 text-primary-700" />
          <p className="text-sm font-semibold text-earth-900">Help &amp; FAQ</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium text-earth-900 hover:no-underline">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-earth-700">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="flex items-center gap-2 rounded bg-primary-50 p-3 text-xs text-earth-700">
          <MessageCircle className="size-4 shrink-0 text-primary-700" />
          <span>Still stuck? Message our WhatsApp assistant anytime for price, demand, and batch status help in your language.</span>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  )
}
