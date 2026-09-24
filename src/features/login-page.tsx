'use client'

import { useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { authFetch } from '@/lib/client-fetch'

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
      const res = await authFetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      login(data.user, data.token)
      toast.success(`Welcome back, ${data.user.name}!`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Login failed') }
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
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="inline-flex items-center justify-center mb-4">
              <img src="/logo.svg" alt="Yber Digitals" className="w-14 h-14 rounded-2xl object-contain" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight">Yber Digitals</h1>
            <p className="text-muted-foreground mt-1">Manage projects, track progress, collaborate</p>
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