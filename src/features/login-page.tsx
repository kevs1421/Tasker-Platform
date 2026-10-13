'use client'

import { useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Sun, Moon, Zap, Database, BrainCircuit, Cpu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { authFetch } from '@/lib/client-fetch'

export default function TechAILoginPage() {
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

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background relative font-sans">
      {/* Theme Toggle - Floating Top Right */}
      {mounted && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-9 h-9 border border-border/80 bg-background/80 backdrop-blur-md shadow-md hover:bg-accent"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-orange-500" />}
          </Button>
        </div>
      )}

      {/* LEFT COLUMN - Futuristic Tech/AI Image Background Showcase */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-slate-950 text-white">
        {/* High-Resolution Tech/AI Photo Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
          style={{ 
            backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80')` 
          }}
        />
        
        {/* Dark Linear Gradient Overlay for Perfect Contrast & Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/30" />

        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center gap-3">
          <img 
            src="/logo.svg" 
            alt="Yber Digitals" 
            className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1.5 backdrop-blur-md border border-white/20 shadow-lg" 
          />
          <span className="font-bold text-xl tracking-wide text-white drop-shadow">Yber Digitals</span>
        </div>

        {/* Central Content / AI Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 max-w-xl space-y-5"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 backdrop-blur-md text-xs text-cyan-300 font-medium shadow-inner">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI-Powered Project Intelligence</span>
          </div>
          
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl text-white drop-shadow-md">
            Visualize progress, predict risks, optimize workflows.
          </h2>
          
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Leverage intelligent insights, automated tracking, and data-driven tools to deliver projects faster and smarter.
          </p>
        </motion.div>

        {/* Bottom AI Feature Showcase */}
        <div className="relative z-10 grid grid-cols-3 gap-4 text-center text-xs text-slate-300 pt-8 border-t border-white/10 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5 backdrop-blur-sm">
            <BrainCircuit className="w-5 h-5 text-cyan-400" />
            <span className="font-medium">Smart Insights</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5 backdrop-blur-sm">
            <Database className="w-5 h-5 text-cyan-400" />
            <span className="font-medium">Data-Driven</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5 backdrop-blur-sm">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="font-medium">Agile Delivery</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Login Form Section */}
      <main className="flex items-center justify-center p-6 lg:p-12 relative bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Header / Logo */}
          <div className="text-center lg:text-left space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="inline-flex lg:hidden items-center justify-center mb-2"
            >
              <img src="/logo.svg" alt="Yber Digitals" className="w-12 h-12 rounded-2xl object-contain" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your AI-powered workspace
            </p>
          </div>

          <Card className="shadow-2xl border-border/50">
            <CardContent className="pt-6">
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
                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}