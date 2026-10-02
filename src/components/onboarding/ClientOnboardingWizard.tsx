'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth'
import type { OnboardingForm, Onboarding } from '@/types'
import { formatRelativeTime } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { authFetch } from '@/lib/client-fetch'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ClipboardList, ChevronLeft, ChevronRight, Building2, Palette, Rocket,
  FileText, Upload, X, CheckCircle2, XCircle, Clock, Loader2, ArrowLeft,
  UserCircle, Check, Info,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UploadedFile {
  url: string
  originalName: string
  filename: string
  size: number
  type: string
}

// ─── Animation Variants ─────────────────────────────────────────────────────────

const fadeSlide = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { duration: 0.3 },
}

// ─── Step Configuration ────────────────────────────────────────────────────────

const STEP_ICONS = [Building2, Palette, Rocket, FileText]
const STEP_LABELS = ['Business Info', 'Brand Assets', 'Project Kickoff', 'Documents']

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
  'Real Estate', 'Manufacturing', 'Media & Entertainment', 'Legal',
  'Non-Profit', 'Government', 'Consulting', 'Other',
]
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const BUDGET_RANGES = ['$1k - $5k', '$5k - $15k', '$15k - $50k', '$50k - $100k', '$100k+']
const TIMELINES = ['1-2 weeks', '2-4 weeks', '1-2 months', '2-3 months', '3-6 months', '6+ months']

// ─── File Upload Zone ───────────────────────────────────────────────────────────

function FileUploadZone({
  label,
  required,
  accept,
  file,
  onUpload,
  onRemove,
  icon: Icon = Upload,
  description,
}: {
  label: string; required?: boolean; accept?: string
  file: UploadedFile | null; onUpload: (file: UploadedFile) => void; onRemove: () => void
  icon?: React.ElementType; description?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (fileObj: File) => {
    // Client-side validation before upload
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (fileObj.size > maxSize) {
      toast.error(`File size (${(fileObj.size / 1024 / 1024).toFixed(1)}MB) exceeds 10MB limit`)
      return
    }
    if (fileObj.size === 0) {
      toast.error('File is empty')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', fileObj)
      const res = await authFetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Upload failed')
      }
      const data = await res.json()
      onUpload({
        url: data.url,
        originalName: data.originalName,
        filename: data.filename,
        size: data.size,
        type: data.type,
      })
      toast.success('File uploaded successfully')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {file ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.originalName}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          <Button
            type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Icon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Click to upload</p>
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Step Indicator Card ────────────────────────────────────────────────────────

function StepCard({
  step, index, currentStep, isCompleted, onClick,
}: {
  step: string; index: number; currentStep: number; isCompleted: boolean; onClick: () => void
}) {
  const Icon = STEP_ICONS[index]
  const isCurrent = index === currentStep
  const isNextStep = index === currentStep + 1
  const isClickable = isCompleted || isCurrent || isNextStep

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(
        'flex-1 min-w-0 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 border',
        isCompleted && 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
        isCurrent && !isCompleted && 'bg-primary/10 border-primary/30',
        !isCurrent && !isCompleted && 'bg-card border-transparent opacity-50',
        isClickable && 'cursor-pointer hover:shadow-sm',
        !isClickable && 'cursor-not-allowed',
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
        isCompleted && 'bg-emerald-500 text-white',
        isCurrent && !isCompleted && 'bg-primary text-primary-foreground',
        !isCurrent && !isCompleted && 'bg-muted text-muted-foreground',
      )}>
        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={cn(
        'text-[11px] md:text-xs font-medium text-center leading-tight',
        isCompleted && 'text-emerald-700 dark:text-emerald-400',
        isCurrent && !isCompleted && 'text-primary',
        !isCurrent && !isCompleted && 'text-muted-foreground',
      )}>
        {step}
      </span>
    </button>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ClientOnboardingWizard() {
  const { user } = useAuthStore()

  // Form list view state
  const [forms, setForms] = useState<(OnboardingForm & { _count?: { submissions: number } })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForm, setSelectedForm] = useState<(OnboardingForm & { submissions: Onboarding[]; _count?: { submissions: number } }) | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, UploadedFile | null>>({})
  const [submitting, setSubmitting] = useState(false)

  const totalSteps = 4

  const fetchForms = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await authFetch(`/api/onboarding?clientId=${user.id}`)
      const data = await res.json()
      setForms(data.forms || [])
    } catch {
      toast.error('Failed to load onboarding forms')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchForms() }, [fetchForms])

  const openForm = async (formId: string) => {
    setFormLoading(true)
    try {
      const res = await authFetch(`/api/onboarding/${formId}?clientId=${user?.id}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to load form')
      }
      const data = await res.json()
      setSelectedForm(data.form)
      setCurrentStep(0)
      setResponses({})
      setFiles({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load form')
    } finally {
      setFormLoading(false)
    }
  }

  const mySubmission = selectedForm?.submissions?.find((s) => s.clientId === user?.id)
  const isLocked = mySubmission?.status === 'approved' || mySubmission?.status === 'submitted'

  // Load existing responses
  useEffect(() => {
    if (mySubmission?.responsesJson) {
      try {
        const parsed = JSON.parse(mySubmission.responsesJson)
        setResponses(parsed.responses || {})
        setFiles(parsed.files || {})
      } catch { /* ignore */ }
    }
  }, [mySubmission?.id])

  const updateResponse = (name: string, value: string) => {
    setResponses((prev) => ({ ...prev, [name]: value }))
  }

  const updateFile = (name: string, file: UploadedFile | null) => {
    setFiles((prev) => ({ ...prev, [name]: file }))
  }

  // Validation
  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return !!(responses.businessName?.trim() && responses.businessEmail?.trim())
      case 1:
        // Brand Assets: company logo is recommended but not required to proceed
        return true
      case 2:
        return !!(responses.projectGoals?.trim() && responses.targetAudience?.trim())
      case 3:
        // Documents: at least one document should be uploaded to proceed, but all are not required
        return !!(files.contractForm || files.paymentForm || files.workOrderAgreement)
      default:
        return true
    }
  }

  const currentStepValid = isStepValid(currentStep)
  const progress = ((currentStep + (currentStepValid ? 1 : 0.5)) / totalSteps) * 100

  const goToStep = (step: number) => {
    if (isLocked) return
    // Allow going back to any completed step, or forward to completed steps
    // Also allow clicking the current step
    if (step <= currentStep || step <= currentStep + 1) setCurrentStep(step)
  }

  const handleNext = () => {
    if (!currentStepValid) {
      toast.error('Please fill in the required fields before proceeding')
      return
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  // Save draft silently (no loading state, no toast on success)
  const saveDraft = useCallback(async () => {
    const submissionId = mySubmission?.id
    if (!submissionId) return
    try {
      const submissionData = JSON.stringify({ responses, files })
      await authFetch(`/api/onboarding/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDraft',
          responsesJson: submissionData,
        }),
      })
    } catch { /* silent */ }
  }, [mySubmission?.id, responses, files])

  // Auto-save draft when navigating between steps
  const handleNextWithSave = () => {
    if (!currentStepValid) {
      toast.error('Please fill in the required fields before proceeding')
      return
    }
    saveDraft()
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevWithSave = () => {
    if (currentStep > 0) {
      saveDraft()
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!selectedForm || !user?.id) return
    if (!currentStepValid) {
      toast.error('Please complete all required fields before submitting')
      return
    }
    setSubmitting(true)
    try {
      const submissionData = JSON.stringify({ responses, files })
      // Always use the submission ID if we have one (from auto-created or existing submission)
      const submissionId = mySubmission?.id
      if (!submissionId) {
        toast.error('No submission found. Please try reloading the form.')
        setSubmitting(false)
        return
      }
      const res = await authFetch(`/api/onboarding/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          responsesJson: submissionData,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Submission failed') }
      toast.success('Onboarding submitted successfully!')
      setSelectedForm(null)
      fetchForms()
    } catch {
      toast.error('Failed to submit onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render Review Result ───────────────────────────────────
  const renderReviewBanner = () => {
    if (!mySubmission) return null
    if (mySubmission.status === 'approved') return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-emerald-800 dark:text-emerald-300">Approved</p>
          {mySubmission.reviewNotes && <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{mySubmission.reviewNotes}</p>}
          {mySubmission.reviewedAt && <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Reviewed {formatRelativeTime(mySubmission.reviewedAt)}</p>}
        </div>
      </div>
    )
    if (mySubmission.status === 'rejected') return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-red-800 dark:text-red-300">Needs Revision</p>
          {mySubmission.reviewNotes && <p className="text-sm text-red-700 dark:text-red-400 mt-1">{mySubmission.reviewNotes}</p>}
          {mySubmission.reviewedAt && <p className="text-xs text-red-600 dark:text-red-500 mt-1">Reviewed {formatRelativeTime(mySubmission.reviewedAt)}</p>}
        </div>
      </div>
    )
    if (mySubmission.status === 'submitted') return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-300">Under Review</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Your submission is being reviewed by the team.</p>
          {mySubmission.submittedAt && <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Submitted {formatRelativeTime(mySubmission.submittedAt)}</p>}
        </div>
      </div>
    )
    return null
  }

  // ─── Render Read-Only Review ───────────────────────────────
  const renderReadOnlyView = () => (
    <div className="space-y-8">
        {/* Business Info */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Business Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { label: 'Business Name', value: responses.businessName },
              { label: 'Business Email', value: responses.businessEmail },
              { label: 'Business Phone', value: responses.businessPhone },
              { label: 'Business Address', value: responses.businessAddress },
              { label: 'Industry', value: responses.industry },
              { label: 'Company Size', value: responses.companySize },
            ] as const).map((field) => (
              <div key={field.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                <p className="text-sm p-3 rounded-lg bg-muted/50 border min-h-[40px]">{field.value || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Brand Assets */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Brand Assets
          </h3>
          {files.companyLogo && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Company Logo</p>
              <div className="w-20 h-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                <img src={files.companyLogo.url} alt="Company logo" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
          {([
            { label: 'Brand Colors', value: responses.brandColors },
            { label: 'Typography / Fonts', value: responses.typography },
          ] as const).map((field) => (
            <div key={field.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
              <p className="text-sm p-3 rounded-lg bg-muted/50 border min-h-[40px]">{field.value || <span className="italic text-muted-foreground">Not provided</span>}</p>
            </div>
          ))}
          {files.brandGuidelines && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Brand Guidelines</p>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm">{files.brandGuidelines.originalName}</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Project Kickoff */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Project Kickoff
          </h3>
          <div className="space-y-4">
            {([
              { label: 'Project Goals', value: responses.projectGoals },
              { label: 'Target Audience', value: responses.targetAudience },
              { label: 'Main Competitors', value: responses.mainCompetitors },
            ] as const).map((field) => (
              <div key={field.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                <p className="text-sm p-3 rounded-lg bg-muted/50 border min-h-[40px] whitespace-pre-wrap">{field.value || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { label: 'Budget Range', value: responses.budgetRange },
              { label: 'Expected Timeline', value: responses.expectedTimeline },
            ] as const).map((field) => (
              <div key={field.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                <p className="text-sm p-3 rounded-lg bg-muted/50 border min-h-[40px]">{field.value || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Documents */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Submitted Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              { key: 'contractForm', label: 'Contract Form' },
              { key: 'paymentForm', label: 'Payment Form' },
              { key: 'workOrderAgreement', label: 'Work Order Agreement' },
            ] as const).map((doc) => {
              const f = files[doc.key]
              return (
                <div key={doc.key} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.label}</p>
                    {f ? (
                      <p className="text-xs text-muted-foreground truncate">{f.originalName}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Not uploaded</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
    </div>
  )

  // ─── Step 1: Business Information ─────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Business Information</h3>
        <p className="text-sm text-muted-foreground">Tell us about your company and business details.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="businessName" className="text-sm">Business Name <span className="text-red-500">*</span></Label>
          <Input id="businessName" placeholder="Enter business name" value={responses.businessName || ''} onChange={(e) => updateResponse('businessName', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessEmail" className="text-sm">Business Email <span className="text-red-500">*</span></Label>
            <Input id="businessEmail" type="email" placeholder="name@company.com" value={responses.businessEmail || ''} onChange={(e) => updateResponse('businessEmail', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessPhone" className="text-sm">Business Phone</Label>
            <Input id="businessPhone" placeholder="+1 (555) 000-0000" value={responses.businessPhone || ''} onChange={(e) => updateResponse('businessPhone', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessAddress" className="text-sm">Business Address</Label>
          <Input id="businessAddress" placeholder="Enter full business address" value={responses.businessAddress || ''} onChange={(e) => updateResponse('businessAddress', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Industry</Label>
            <Select value={responses.industry || ''} onValueChange={(v) => updateResponse('industry', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Company Size</Label>
            <Select value={responses.companySize || ''} onValueChange={(v) => updateResponse('companySize', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select company size" /></SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Step 2: Brand Assets ─────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Brand Assets</h3>
        <p className="text-sm text-muted-foreground">Upload your brand materials and specify your visual identity.</p>
      </div>

      <div className="space-y-5">
        <FileUploadZone
          label="Company Logo"
          required
          accept="image/*"
          file={files.companyLogo || null}
          onUpload={(f) => updateFile('companyLogo', f)}
          onRemove={() => updateFile('companyLogo', null)}
          icon={Building2}
          description="PNG, JPG or SVG. Recommended 512x512px."
        />

        <div className="space-y-1.5">
          <Label htmlFor="brandColors" className="text-sm">Brand Colors</Label>
          <Input id="brandColors" placeholder="e.g., #0142A0, #AA0C5B" value={responses.brandColors || ''} onChange={(e) => updateResponse('brandColors', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="typography" className="text-sm">Typography / Fonts</Label>
          <Input id="typography" placeholder="e.g., Inter, Poppins" value={responses.typography || ''} onChange={(e) => updateResponse('typography', e.target.value)} />
        </div>

        <FileUploadZone
          label="Brand Guidelines Document"
          accept=".pdf,.doc,.docx"
          file={files.brandGuidelines || null}
          onUpload={(f) => updateFile('brandGuidelines', f)}
          onRemove={() => updateFile('brandGuidelines', null)}
          description="PDF or Word document."
        />
      </div>
    </div>
  )

  // ─── Step 3: Project Kickoff ──────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Project Kickoff</h3>
        <p className="text-sm text-muted-foreground">Help us understand your project goals and requirements.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="projectGoals" className="text-sm">Project Goals <span className="text-red-500">*</span></Label>
          <Textarea id="projectGoals" placeholder="Describe your main project goals and objectives" rows={4} value={responses.projectGoals || ''} onChange={(e) => updateResponse('projectGoals', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetAudience" className="text-sm">Target Audience <span className="text-red-500">*</span></Label>
          <Textarea id="targetAudience" placeholder="Describe your target audience" rows={3} value={responses.targetAudience || ''} onChange={(e) => updateResponse('targetAudience', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mainCompetitors" className="text-sm">Main Competitors</Label>
          <Input id="mainCompetitors" placeholder="e.g., Competitor A, Competitor B" value={responses.mainCompetitors || ''} onChange={(e) => updateResponse('mainCompetitors', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Budget Range</Label>
            <Select value={responses.budgetRange || ''} onValueChange={(v) => updateResponse('budgetRange', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select budget range" /></SelectTrigger>
              <SelectContent>
                {BUDGET_RANGES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Expected Timeline</Label>
            <Select value={responses.expectedTimeline || ''} onValueChange={(v) => updateResponse('expectedTimeline', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select timeline" /></SelectTrigger>
              <SelectContent>
                {TIMELINES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Step 4: Document Submission ──────────────────────────
  const renderStep4 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Document Submission</h3>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
        <Info className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sky-800 dark:text-sky-300 text-sm">Required Documents</p>
          <p className="text-sm text-sky-700 dark:text-sky-400 mt-0.5">Please upload the following documents to complete your onboarding. All files should be in PDF format.</p>
        </div>
      </div>

      <div className="space-y-5">
        <FileUploadZone
          label="Contract Form"
          required
          accept=".pdf,.doc,.docx"
          file={files.contractForm || null}
          onUpload={(f) => updateFile('contractForm', f)}
          onRemove={() => updateFile('contractForm', null)}
          icon={FileText}
          description="Click to upload contract"
        />
        <FileUploadZone
          label="Payment Form"
          required
          accept=".pdf,.doc,.docx"
          file={files.paymentForm || null}
          onUpload={(f) => updateFile('paymentForm', f)}
          onRemove={() => updateFile('paymentForm', null)}
          icon={FileText}
          description="Click to upload payment form"
        />
        <FileUploadZone
          label="Work Order Agreement"
          required
          accept=".pdf,.doc,.docx"
          file={files.workOrderAgreement || null}
          onUpload={(f) => updateFile('workOrderAgreement', f)}
          onRemove={() => updateFile('workOrderAgreement', null)}
          icon={FileText}
          description="Click to upload work order"
        />
      </div>
    </div>
  )

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4]

  // ─── Form Wizard View ─────────────────────────────────────
  if (selectedForm) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedForm(null); fetchForms() }} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">Client Onboarding</h1>
              <p className="text-sm text-muted-foreground truncate">Complete the onboarding process to get started with your project</p>
            </div>
          </div>
        </div>

        {/* Project badge */}
        {selectedForm.project && (
          <Badge variant="outline" style={{ borderColor: selectedForm.project.color, color: selectedForm.project.color }}>
            {selectedForm.project.name}
          </Badge>
        )}

        {/* Review banner */}
        {renderReviewBanner()}

        {/* Status + Progress */}
        <div className="bg-card border rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Onboarding Status</p>
              </div>
            </div>
            <Badge className={cn(
              mySubmission?.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              mySubmission?.status === 'submitted' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
              mySubmission?.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            )}>
              {mySubmission?.status === 'approved' ? 'Completed' :
               mySubmission?.status === 'submitted' ? 'Submitted' :
               mySubmission?.status === 'rejected' ? 'Revision Needed' :
               'In Progress'}
            </Badge>
          </div>
          <Progress value={isLocked ? 100 : progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
          </p>
        </div>

        {/* Step Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {STEP_LABELS.map((label, i) => (
            <StepCard
              key={label}
              step={label}
              index={i}
              currentStep={currentStep}
              isCompleted={i < currentStep || isLocked}
              onClick={() => goToStep(i)}
            />
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-5 md:p-6">
            {isLocked ? (
              renderReadOnlyView()
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={currentStep} {...fadeSlide}>
                  {stepRenderers[currentStep]()}
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        {!isLocked && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevWithSave}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>

            {currentStep < totalSteps - 1 ? (
              <Button onClick={handleNextWithSave} disabled={!currentStepValid} className="bg-primary hover:bg-primary/90">
                Next Step <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!currentStepValid || submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Submit Onboarding
              </Button>
            )}
          </div>
        )}

        {formLoading && (
          <div className="fixed inset-0 bg-background/60 flex items-center justify-center z-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    )
  }

  // ─── Form List View (default) ─────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Complete your onboarding forms to get started</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No onboarding forms</h3>
          <p className="text-sm text-muted-foreground max-w-sm">There are no onboarding forms assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form, i) => {
            const formWithSubs = form as unknown as { submissions?: Onboarding[] }
            const submission = formWithSubs.submissions?.find((s: Onboarding) => s.clientId === user?.id)
            const project = form.project as { color?: string; name?: string } | undefined
            return (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-amber-500"
                  onClick={() => openForm(form.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold leading-tight">{form.title}</CardTitle>
                      {project?.name && (
                        <Badge variant="outline" className="ml-2 shrink-0 text-xs" style={{ borderColor: project.color, color: project.color }}>
                          {project.name}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {form.description || 'Complete this onboarding form to proceed with your project.'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{form._count?.submissions || 0} submission{((form._count?.submissions || 0) !== 1) ? 's' : ''}</span>
                      </div>
                      {submission && (
                        <Badge variant="secondary" className={cn(
                          'text-[10px]',
                          submission.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          submission.status === 'submitted' ? 'bg-sky-100 text-sky-700' :
                          submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {submission.status === 'approved' ? 'Completed' :
                           submission.status === 'submitted' ? 'Submitted' :
                           submission.status === 'rejected' ? 'Revision Needed' :
                           'In Progress'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {formLoading && (
        <div className="fixed inset-0 bg-background/60 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}
    </div>
  )
}