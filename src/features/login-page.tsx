'use client'

import { useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    if (!loginData.email || !loginData.password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const res = await authFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      login(data.user, data.token)
      toast.success(`Welcome back, ${data.user.name}!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen flex w-full bg-background relative transition-colors duration-300">
      {/* Theme Toggle Button */}
      {mounted && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-9 h-9 bg-card/80 backdrop-blur border-border/50 shadow-sm hover:bg-accent"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </Button>
        </div>
      )}

      {/* Grid Layout: Left Column = Full Background Image | Right Column = Login Form */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        
        {/* LEFT COLUMN: Full background image + Theme responsive overlay */}
        <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-white">
          
          {/* Animated Full Image Background */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isDark ? 'dark-bg' : 'light-bg'}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 z-0"
            >
              <img
                src={isDark ? '/hero-dark.jpg' : '/hero-light.jpg'}
                alt="Workspace Background"
                className="w-full h-full object-cover object-center"
              />
            </motion.div>
          </AnimatePresence>

          {/* Dynamic Light/Dark Overlay to guarantee readability & atmosphere */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/30 dark:from-slate-950/90 dark:via-slate-950/60 dark:to-slate-950/40" />

          {/* Ambient Glow Orbs */}
          <div className="absolute inset-0 z-10 opacity-30 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-blue-500/30 blur-3xl" />
          </div>

          {/* Top Content */}
          <div className="relative z-20 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase bg-white/10 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm">
              Workspace Platform
            </span>
          </div>

          {/* Middle Highlight Banner */}
          <div className="relative z-20 my-auto max-w-lg space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Manage projects, track progress & collaborate seamlessly.
            </h2>
            <p className="text-base text-white/80 leading-relaxed font-normal">
              Experience a unified workflow platform designed for high-performing teams and agency operations.
            </p>
          </div>

          {/* Bottom Quote / Footer */}
          <div className="relative z-20">
            <blockquote className="space-y-1 border-l-2 border-primary/80 pl-4">
              <p className="text-sm font-medium italic text-white/90">
                “Streamlining digital workflows and team collaboration in one unified space.”
              </p>
              <footer className="text-xs text-white/60">
                Powered by Yber Digitals Platform
              </footer>
            </blockquote>
          </div>

        </div>

        {/* RIGHT COLUMN: Login Form */}
        <main className="flex flex-col items-center justify-center p-6 lg:p-12 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Header / Logo */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="inline-flex items-center justify-center mb-4"
              >
                <img
                  src="/logo.svg"
                  alt="Yber Digitals"
                  className="w-14 h-14 rounded-2xl object-contain shadow-md"
                />
              </motion.div>
              <h1 className="text-3xl font-bold tracking-tight">Yber Digitals</h1>
              <p className="text-muted-foreground mt-1">
                Manage projects, track progress, collaborate
              </p>
            </div>

            {/* Form Card */}
            <Card className="shadow-lg border-border/50 bg-card/90 backdrop-blur">
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-center">Sign In</h2>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Enter your credentials to access your workspace
                  </p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="name@company.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Footer Features */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Admin Panel</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Kanban Board</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Client Portal</span>
              </div>
            </div>
          </motion.div>
        </main>

      </div>
    </div>
  )
}