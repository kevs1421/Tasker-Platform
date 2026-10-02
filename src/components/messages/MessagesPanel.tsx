'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import type { Message, User, MessageGroup, GroupMember } from '@/types'
import { getRoleBadgeClasses, getInitials, formatRelativeTime } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search, Send, MessageSquare, Users, Plus, Loader2, CheckCheck, X, UserPlus, Trash2,
} from 'lucide-react'
import { useVideoCall } from '@/hooks/use-video-call'
import { VideoCallPanel, VideoCallButtons, GroupCallButtons, IncomingCallOverlay } from './VideoCall'
import { authFetch } from '@/lib/client-fetch'

// ─── Role-based messaging visibility ───────────────────────────────────────────
// admin & team → can message admin, team, client, training
// training   → can message admin, team only
// client     → can message admin, team only
function canMessageRole(myRole: string, theirRole: string): boolean {
  if (myRole === 'admin' || myRole === 'team') {
    // admin/team can message everyone
    return true
  }
  if (myRole === 'training') {
    // training can message admin, team only
    return theirRole === 'admin' || theirRole === 'team'
  }
  if (myRole === 'client') {
    // client can message admin, team only
    return theirRole === 'admin' || theirRole === 'team'
  }
  return false
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DirectConversation {
  type: 'direct'
  user: User | null
  lastMessage: Message | null
  unread: number
}

interface GroupConversation {
  type: 'group'
  group: {
    id: string; name: string; avatar?: string | null
    members: { userId: string; user: { id: string; name: string; avatar?: string | null } | null }[]
    _count: { members: number }
    createdAt: string; updatedAt: string
  }
  lastMessage: Message | null
  unread: number
}

type Conversation = DirectConversation | GroupConversation

// ─── Avatar helpers ─────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 'md', className }: { user?: User | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeMap = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-12 w-12 text-sm' }
  if (!user) return <div className={cn(sizeMap[size], 'rounded-full bg-muted flex items-center justify-center', className)}>?</div>
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {user.avatar && <AvatarImage src={user.avatar} />}
      <AvatarFallback className="bg-slate-100 dark:bg-slate-800 font-medium">
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

function GroupAvatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeMap = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-12 w-12 text-sm' }
  return (
    <div className={cn(sizeMap[size], 'rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center', className)}>
      <Users className={size === 'sm' ? 'h-3.5 w-3.5 text-violet-600 dark:text-violet-400' : size === 'md' ? 'h-4 w-4 text-violet-600 dark:text-violet-400' : 'h-5 w-5 text-violet-600 dark:text-violet-400'} />
    </div>
  )
}

// ─── Create Group Dialog ───────────────────────────────────────────────────────

function CreateGroupDialog({
  open, onOpenChange, onCreated, currentUser,
}: {
  open: boolean; onOpenChange: (open: boolean) => void;
  onCreated: (group: MessageGroup) => void; currentUser: User;
}) {
  const [name, setName] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setName('')
    setSelectedIds([])
    setSearch('')
    authFetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        setUsers((d.users ?? []).filter((u: User) => {
          if (u.id === currentUser.id) return false
          if (!canMessageRole(currentUser.role, u.role)) return false
          return true
        }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, currentUser.id, currentUser.role])

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId])
  }

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.length === 0) return
    setCreating(true)
    try {
      const res = await authFetch('/api/message-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), createdBy: currentUser.id, memberIds: selectedIds }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success('Group created')
      onCreated(data.group)
      onOpenChange(false)
    } catch {
      toast.error('Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" /> Create Group
          </DialogTitle>
          <DialogDescription>Start a group conversation with team members</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Input placeholder="Group name..." value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ScrollArea className="max-h-48 rounded-md border">
              {loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              ) : (
                <div className="p-1">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleUser(u.id)}
                    >
                      <Checkbox checked={selectedIds.includes(u.id)} />
                      <UserAvatar user={u} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="secondary" className={cn('text-[10px]', getRoleBadgeClasses(u.role))}>{u.role}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{selectedIds.length} member{selectedIds.length > 1 ? 's' : ''} selected</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            onClick={handleCreate} disabled={!name.trim() || selectedIds.length === 0 || creating}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── New Message Dialog ────────────────────────────────────────────────────────

function NewMessageDialog({
  open, onOpenChange, onUserSelected, currentUser,
}: {
  open: boolean; onOpenChange: (open: boolean) => void
  onUserSelected: (user: User) => void; currentUser: User;
}) {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect -- intentional: show loading on dialog open
    authFetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setUsers((d.users ?? []).filter((u: User) => {
          if (u.id === currentUser.id) return false
          if (!canMessageRole(currentUser.role, u.role)) return false
          return true
        }))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, currentUser.id, currentUser.role])

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-600" /> New Message
          </DialogTitle>
          <DialogDescription>Choose a person to start a conversation</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
          <ScrollArea className="max-h-72 rounded-md border">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            ) : (
              <div className="p-1">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                    onClick={() => { onUserSelected(u); onOpenChange(false) }}
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="secondary" className={cn('text-[10px]', getRoleBadgeClasses(u.role))}>{u.role}</Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Group Info Dialog ──────────────────────────────────────────────────────────

function GroupInfoDialog({
  open, onOpenChange, group, currentUserId, currentUserRole,
}: {
  open: boolean; onOpenChange: (open: boolean) => void
  group: { id: string; name: string; members?: GroupMember[]; _count?: { members: number } } | null
  currentUserId: string; currentUserRole: string
}) {
  const [members, setMembers] = useState<(GroupMember & { user: User })[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!open || !group) return
    setLoading(true)
    setSearch('')
    setShowAddUser(false)
    authFetch(`/api/message-groups/${group.id}?userId=${currentUserId}`)
      .then((r) => r.json())
      .then((d) => {
        setMembers((d.group?.members ?? []) as (GroupMember & { user: User })[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, group, currentUserId])

  const handleAddMember = async (userId: string) => {
    if (!group) return
    try {
      const res = await authFetch(`/api/message-groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMemberIds: [userId] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMembers(data.group.members ?? [])
      toast.success('Member added')
    } catch {
      toast.error('Failed to add member')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!group) return
    try {
      const res = await authFetch(`/api/message-groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeMemberIds: [userId] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMembers(data.group.members ?? [])
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const handleLoadUsers = () => {
    authFetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        const memberIds = members.map((m) => m.userId)
        setUsers((d.users ?? []).filter((u: User) => {
          if (memberIds.includes(u.id)) return false
          if (!canMessageRole(currentUserRole, u.role)) return false
          return true
        }))
      })
      .catch(() => {})
    setShowAddUser(true)
  }

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" /> Group Info
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {group && (
            <div className="flex items-center gap-3">
              <GroupAvatar name={group.name} size="lg" />
              <div>
                <p className="font-semibold">{group.name}</p>
                <p className="text-sm text-muted-foreground">{group._count?.members ?? members.length} members</p>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Members</p>
              {!showAddUser && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" type="button" onClick={handleLoadUsers}>
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </div>

            {showAddUser && (
              <div className="mb-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <ScrollArea className="max-h-32 rounded-md border">
                  <div className="p-1">
                    {filteredUsers.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleAddMember(u.id)}
                      >
                        <UserAvatar user={u} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                        </div>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <Button variant="ghost" size="sm" className="h-7 text-xs" type="button" onClick={() => setShowAddUser(false)}>Done</Button>
              </div>
            )}

            <ScrollArea className="max-h-48 rounded-md border">
              {loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="p-1">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50">
                      <UserAvatar user={m.user} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.user?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{m.role === 'admin' ? 'Admin' : 'Member'}</p>
                      </div>
                      {m.userId !== currentUserId && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" type="button" onClick={() => handleRemoveMember(m.userId)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main MessagesPanel Component ───────────────────────────────────────────────

export function MessagesPanel() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'message' | 'conversation'; id: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const videoCall = useVideoCall(user ?? null)

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/messages?userId=${user.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Filter conversations based on role-based messaging visibility
      setConversations((data.conversations ?? []).filter((c: Conversation) => {
        if (c.type === 'direct' && c.user && !canMessageRole(user.role, c.user.role)) return false
        return true
      }))
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Determine conversation kind
  const isGroupSelected = selectedConvo?.type === 'group'
  const selectedGroup = isGroupSelected ? (selectedConvo as GroupConversation).group : null
  const selectedDirectUser = !isGroupSelected ? (selectedConvo as DirectConversation | null)?.user : null

  const selectConversation = async (convo: Conversation) => {
    if (!user?.id) return
    setSelectedConvo(convo)
    setMsgText('')
    setMsgLoading(true)

    try {
      let url = `/api/messages?userId=${user.id}`
      if (convo.type === 'group') {
        url += `&groupId=${convo.group.id}`
      } else {
        if (!convo.user) return
        url += `&otherId=${convo.user.id}`
      }
      const res = await authFetch(url)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setMsgLoading(false)
    }

    // Clear unread locally
    setConversations((prev) => prev.map((c) => {
      if (c.type === 'direct' && convo.type === 'direct' && c.user?.id === convo.user?.id) return { ...c, unread: 0 }
      if (c.type === 'group' && convo.type === 'group' && c.group.id === convo.group.id) return { ...c, unread: 0 }
      return c
    }))
  }

  const sendMessage = async () => {
    if (!user?.id || !msgText.trim() || !selectedConvo) return

    setSending(true)
    const text = msgText.trim()
    setMsgText('')

    try {
      const body: Record<string, string> = { content: text, senderId: user.id }

      if (selectedConvo.type === 'group') {
        body.groupId = selectedConvo.group.id
      } else {
        if (!selectedConvo.user) return
        body.receiverId = selectedConvo.user.id
      }

      const res = await authFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
      fetchConversations()
    } catch {
      toast.error('Failed to send message')
      setMsgText(text)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Delete a single message
  const deleteMessage = async (messageId: string) => {
    if (!user?.id) return
    try {
      const res = await authFetch(`/api/messages?id=${messageId}&userId=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      toast.success('Message deleted')
    } catch {
      toast.error('Failed to delete message')
    }
    setDeleteConfirm(null)
  }

  // Delete an entire conversation
  const deleteConversation = async () => {
    if (!user?.id || !deleteConfirm) return
    // Use the conversation that was targeted for deletion, not the currently selected one
    const targetConvo = conversations.find(c => {
      if (c.type === 'group' && deleteConfirm.type === 'conversation') return c.group.id === deleteConfirm.id
      if (c.type === 'direct' && deleteConfirm.type === 'conversation') return c.user?.id === deleteConfirm.id
      return false
    })
    try {
      let url = `/api/messages?deleteConversation=true&userId=${user.id}`
      if (targetConvo?.type === 'group') {
        url += `&groupId=${targetConvo.group.id}`
      } else if (targetConvo?.type === 'direct' && targetConvo.user) {
        url += `&otherId=${targetConvo.user.id}`
      } else if (selectedConvo?.type === 'group') {
        url += `&groupId=${selectedConvo.group.id}`
      } else if (selectedConvo?.type === 'direct' && selectedConvo.user) {
        url += `&otherId=${selectedConvo.user.id}`
      }
      const res = await authFetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSelectedConvo(null)
      setMessages([])
      fetchConversations()
      toast.success('Conversation deleted')
    } catch {
      toast.error('Failed to delete conversation')
    }
    setDeleteConfirm(null)
  }

  // Handle selecting a user from New Message dialog
  const handleNewMessageUser = async (selectedUser: User) => {
    // Check if a conversation already exists
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.user?.id === selectedUser.id
    )
    if (existing) {
      await selectConversation(existing)
      return
    }
    // Create a new direct conversation object and select it
    const newConvo: DirectConversation = {
      type: 'direct',
      user: selectedUser,
      lastMessage: null,
      unread: 0,
    }
    setSelectedConvo(newConvo)
    setMessages([])
  }

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    if (c.type === 'direct') return c.user?.name.toLowerCase().includes(q) || c.user?.email.toLowerCase().includes(q)
    return c.group.name.toLowerCase().includes(q)
  })

  // Conversation display helpers
  const getConvoPreview = (c: Conversation) => {
    if (!c.lastMessage) return 'No messages yet'
    const senderName = c.lastMessage.senderId === user?.id ? 'You' : (c.lastMessage.sender?.name ?? 'Someone')
    if (c.type === 'group') return `${senderName}: ${c.lastMessage.content}`
    return `${c.lastMessage.senderId === user?.id ? 'You: ' : ''}${c.lastMessage.content}`
  }

  // ── Render ───────────────────────────────────────────────

  const containerHeight = 'h-[calc(100vh-12rem)]'

  if (loading) {
    return (
      <div className={cn(containerHeight, 'flex border rounded-lg overflow-hidden')}>
        <div className="w-80 border-r p-4 space-y-3 flex-shrink-0">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select a conversation</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(containerHeight, 'flex border rounded-lg overflow-hidden')}
    >
      {/* ─── Conversation List ──────────────────────────── */}
      <div className="w-80 border-r bg-background flex flex-col flex-shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Messages</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setShowNewMessage(true)}
                title="New Message"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setShowCreateGroup(true)}
                title="Create Group"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {filteredConversations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </p>
            )}
            {filteredConversations.map((convo, idx) => {
              const isSelected =
                convo.type === 'direct'
                  ? selectedDirectUser?.id === convo.user?.id
                  : selectedGroup?.id === convo.group.id
              return (
                <div
                  key={convo.type === 'direct' ? convo.user?.id ?? idx : convo.group.id}
                  className={cn(
                    'group flex items-center rounded-md transition-colors',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <button
                    className="w-full text-left px-3 py-3 flex items-start gap-3 flex-1 min-w-0"
                    onClick={() => selectConversation(convo)}
                  >
                    {convo.type === 'direct' ? (
                      <UserAvatar user={convo.user} size="md" className="mt-0.5 flex-shrink-0" />
                    ) : (
                      <GroupAvatar name={convo.group.name} size="md" className="mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate">{convo.type === 'direct' ? (convo.user?.name ?? 'Unknown') : convo.group.name}</span>
                          {convo.type === 'group' && (
                            <Users className="h-3 w-3 text-violet-500 flex-shrink-0" />
                          )}
                        </div>
                        {convo.lastMessage && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                            {formatRelativeTime(convo.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {getConvoPreview(convo)}
                      </p>
                    </div>
                    {convo.unread > 0 && (
                      <div className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-1">
                        {convo.unread}
                      </div>
                    )}
                  </button>
                  {/* Delete conversation button — shows on hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0 mr-1 mt-1"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'conversation', id: convo.type === 'direct' ? (convo as DirectConversation).user?.id ?? '' : convo.group.id }) }}
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Chat Area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedConvo ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b flex items-center gap-3">
              {isGroupSelected ? (
                <button onClick={() => setShowGroupInfo(true)} className="flex items-center gap-3 hover:bg-muted/50 rounded-md px-1 -ml-1 py-0.5 transition-colors">
                  <GroupAvatar name={selectedGroup!.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {selectedGroup!.name}
                      <Users className="h-3.5 w-3.5 text-violet-500" />
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedGroup!._count.members} members</p>
                  </div>
                </button>
              ) : selectedDirectUser ? (
                <>
                  <UserAvatar user={selectedDirectUser} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{selectedDirectUser.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedDirectUser.company ?? selectedDirectUser.email}
                    </p>
                  </div>
                  <Badge variant="secondary" className={cn('text-xs flex-shrink-0', getRoleBadgeClasses(selectedDirectUser.role))}>
                    {selectedDirectUser.role}
                  </Badge>
                </>
              ) : null}

              {/* Call and delete buttons in header */}
              <div className="flex items-center gap-0.5 ml-auto">
                {isGroupSelected && selectedGroup && (
                  <GroupCallButtons
                    onVideo={() => videoCall.startGroupCall(selectedGroup.id, selectedGroup.name, 'video')}
                    onAudio={() => videoCall.startGroupCall(selectedGroup.id, selectedGroup.name, 'audio')}
                    disabled={videoCall.isInCall}
                  />
                )}
                {!isGroupSelected && selectedDirectUser && (
                  <VideoCallButtons
                    onVideo={() => videoCall.startCall(selectedDirectUser, 'video')}
                    onAudio={() => videoCall.startCall(selectedDirectUser, 'audio')}
                    disabled={videoCall.isInCall}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => setDeleteConfirm({ type: 'conversation', id: '' })}
                  title="Delete conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {msgLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={cn('flex gap-2.5', i % 2 === 0 ? '' : 'justify-end')}>
                        <Skeleton className="h-10 w-48 rounded-2xl" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {isGroupSelected ? 'No messages yet. Start the conversation!' : 'No messages yet. Say hello!'}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isSent = msg.senderId === user?.id
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.015, 0.2) }}
                        className={cn('group/msg flex gap-2.5', isSent ? 'justify-end' : 'justify-start')}
                      >
                        {!isSent && (
                          <UserAvatar user={msg.sender} size="sm" className="mt-auto" />
                        )}
                        <div className={cn('max-w-[70%]', isSent ? 'text-right' : '')}>
                          {isGroupSelected && !isSent && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                              {msg.sender?.name ?? 'Unknown'}
                            </p>
                          )}
                          <div className="relative">
                            <div className={cn(
                              'inline-block rounded-2xl px-4 py-2.5 text-sm',
                              isSent
                                ? 'bg-emerald-600 text-white rounded-br-md'
                                : 'bg-muted rounded-bl-md',
                            )}>
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            {/* Delete message button — shows on hover */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-6 w-6 absolute opacity-0 group-hover/msg:opacity-100 transition-opacity',
                                isSent
                                  ? '-left-8 top-1/2 -translate-y-1/2'
                                  : '-right-8 top-1/2 -translate-y-1/2'
                              )}
                              onClick={() => setDeleteConfirm({ type: 'message', id: msg.id })}
                              title="Delete message"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                          <div className={cn(
                            'flex items-center gap-1 mt-1 text-[10px] text-muted-foreground',
                            isSent ? 'justify-end' : 'justify-start'
                          )}>
                            <span>{formatRelativeTime(msg.createdAt)}</span>
                            {isSent && msg.read && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  placeholder={isGroupSelected ? `Message ${selectedGroup!.name}...` : 'Type a message...'}
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!msgText.trim() || sending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Select a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a conversation from the sidebar, or start a new one.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewMessage(true)}>
                  <MessageSquare className="h-4 w-4" /> New Message
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCreateGroup(true)}>
                  <Users className="h-4 w-4" /> Create Group
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Dialogs ──────────────────────────────────── */}
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onCreated={() => { fetchConversations(); setShowCreateGroup(false) }}
        currentUser={user!}
      />
      <NewMessageDialog
        open={showNewMessage}
        onOpenChange={setShowNewMessage}
        onUserSelected={handleNewMessageUser}
        currentUser={user!}
      />
      <GroupInfoDialog
        open={showGroupInfo}
        onOpenChange={setShowGroupInfo}
        group={selectedGroup ? { id: selectedGroup.id, name: selectedGroup.name, _count: selectedGroup._count } : null}
        currentUserId={user?.id ?? ''}
        currentUserRole={user?.role ?? ''}
      />

      <VideoCallPanel
        currentUser={user!}
        targetUser={videoCall.remoteUser}
        isInCall={videoCall.isInCall}
        callType={videoCall.callType}
        callStatus={videoCall.callStatus}
        onEnd={videoCall.endCall}
        onToggleMic={videoCall.toggleMic}
        onToggleCamera={videoCall.toggleCamera}
        onToggleScreen={videoCall.toggleScreen}
        onApplyVirtualBg={videoCall.applyVirtualBackgroundStream}
        onRemoveVirtualBg={videoCall.removeVirtualBackgroundStream}
        micOn={videoCall.micOn}
        cameraOn={videoCall.cameraOn}
        screenOn={videoCall.screenOn}
        remoteScreenOn={videoCall.remoteScreenOn}
        remoteMicOn={videoCall.remoteMicOn}
        remoteCameraOn={videoCall.remoteCameraOn}
        screenShareLabel={videoCall.screenShareLabel}
        localStream={videoCall.getLocalStreamRef()}
      />
      <AnimatePresence>
        {videoCall.incomingCall && (
          <IncomingCallOverlay
            caller={videoCall.incomingCall.caller}
            callType={videoCall.incomingCall.callType}
            onAccept={videoCall.acceptCall}
            onReject={videoCall.rejectCall}
          />
        )}
      </AnimatePresence>
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === 'message' ? 'Delete Message' : 'Delete Conversation'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'message'
                ? 'Are you sure you want to delete this message? This action cannot be undone.'
                : 'Are you sure you want to delete this entire conversation? All messages will be permanently removed. This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!deleteConfirm) return
                if (deleteConfirm.type === 'message') {
                  deleteMessage(deleteConfirm.id)
                } else {
                  deleteConversation()
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}