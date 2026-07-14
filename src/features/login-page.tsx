'use client'

import { useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { CheckCircle2, LayoutDashboard, Loader2, Sun, Moon, Monitor, Shield, Users, Briefcase } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { User } from '@/types'

const DEMO_ACCOUNTS: Array<{ label: string; email: string; password: string; icon: typeof Shield; user: User }> = [
  {
    label: 'Admin',
    email: 'admin@taskflow.com',
    password: 'admin123',
    icon: Shield,
    user: { id: 'demo-admin', email: 'admin@taskflow.com', name: 'Alex Morgan', role: 'admin', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  },
  {
    label: 'Team',
    email: 'sarah@taskflow.com',
    password: 'team123',
    icon: Users,
    user: { id: 'demo-team', email: 'sarah@taskflow.com', name: 'Sarah Chen', role: 'team', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  },
  {
    label: 'Client',
    email: 'john@client.com',
    password: 'client123',
    icon: Briefcase,
    user: { id: 'demo-client', email: 'john@client.com', name: 'John Smith', role: 'client', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  },
]

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const { login } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginData.email || !loginData.password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Login failed')
      login(data.user)
      toast.success(`Welcome back, ${data.user.name}!`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Login failed') }
    finally { setLoading(false) }
  }

  const handleQuickAccess = async (account: typeof DEMO_ACCOUNTS[number]) => {
    setLoading(true)
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) })
      const data = await res.json()
      if (res.ok) {
        login(data.user)
        toast.success(`Welcome back, ${data.user.name}!`)
      } else {
        // Server unreachable or error — bypass login directly
        login(account.user)
        toast.success(`Signed in as ${account.user.name} (offline)`)
      }
    } catch {
      // Network error — bypass login directly
      login(account.user)
      toast.success(`Signed in as ${account.user.name} (offline)`)
    }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* Theme toggle */}
      {mounted && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-9 h-9 bg-card/80 backdrop-blur border-border/50 shadow-sm"
            onClick={() => {
              if (theme === 'dark') setTheme('light')
              else if (theme === 'light') setTheme('system')
              else setTheme('dark')
            }}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </Button>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-4">
              <LayoutDashboard className="w-7 h-7" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight">TaskFlow</h1>
            <p className="text-muted-foreground mt-1">Manage projects, track progress, collaborate</p>
          </div>

          {/* Quick Access — skip login entirely */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.label}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1.5 cursor-pointer"
                disabled={loading}
                onClick={() => handleQuickAccess(account)}
              >
                <account.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{account.label}</span>
              </Button>
            ))}
          </div>

          <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">or sign in manually</span>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-center">Sign In</h2>
                <p className="text-sm text-muted-foreground text-center mt-1">Enter your credentials to access your workspace</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="name@company.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /><span>Admin Panel</span></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /><span>Kanban Board</span></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-rose-500" /><span>Client Portal</span></div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}