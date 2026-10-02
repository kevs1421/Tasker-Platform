export function getRoleBadgeClasses(role: string) {
  switch (role) {
    case 'admin': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'team': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'training': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
    case 'client': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return '?'
  return name.trim().split(/\s+/).filter(Boolean).map(n => n[0].toUpperCase()).join('').slice(0, 2)
}

export function getPriorityConfig(priority: string) {
  const map: Record<string, { label: string; color: string; dotColor: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-500 text-white', dotColor: 'bg-red-500' },
    high: { label: 'High', color: 'bg-orange-500 text-white', dotColor: 'bg-orange-500' },
    medium: { label: 'Medium', color: 'bg-yellow-500 text-white', dotColor: 'bg-yellow-500' },
    low: { label: 'Low', color: 'bg-slate-400 text-white', dotColor: 'bg-slate-400' },
  }
  return map[priority] || map.medium
}

export function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; dotColor: string }> = {
    todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dotColor: 'bg-slate-400' },
    in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dotColor: 'bg-amber-500' },
    in_review: { label: 'In Review', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dotColor: 'bg-purple-500' },
    done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  }
  return map[status] || map.todo
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  return `${months[d.getMonth()]} ${day}, ${d.getFullYear()}`
}

export function formatRelativeTime(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}