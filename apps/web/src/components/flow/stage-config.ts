import {
  ListTodo,
  MessageSquare,
  FileText,
  Zap,
  Play,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Stage } from '@loopforge/shared'
import type { LucideIcon } from 'lucide-react'

export interface StageConfig {
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  hex: string
}

export const STAGE_CONFIG: Record<Stage, StageConfig> = {
  [Stage.TODO]: {
    label: 'To Do',
    icon: ListTodo,
    color: 'bg-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    textColor: 'text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-300 dark:border-slate-700',
    hex: '#64748b',
  },
  [Stage.BRAINSTORMING]: {
    label: 'Brainstorming',
    icon: MessageSquare,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-50 dark:bg-violet-900/40',
    textColor: 'text-violet-700 dark:text-violet-300',
    borderColor: 'border-violet-300 dark:border-violet-700',
    hex: '#8b5cf6',
  },
  [Stage.PLANNING]: {
    label: 'Planning',
    icon: FileText,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    hex: '#3b82f6',
  },
  [Stage.READY]: {
    label: 'Ready',
    icon: Zap,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/40',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-700',
    hex: '#f59e0b',
  },
  [Stage.EXECUTING]: {
    label: 'Executing',
    icon: Play,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/40',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    hex: '#10b981',
  },
  [Stage.CODE_REVIEW]: {
    label: 'Code Review',
    icon: GitPullRequest,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/40',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-700',
    hex: '#f97316',
  },
  [Stage.DONE]: {
    label: 'Done',
    icon: CheckCircle2,
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    hex: '#22c55e',
  },
  [Stage.STUCK]: {
    label: 'Stuck',
    icon: AlertTriangle,
    color: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/40',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-700',
    hex: '#ef4444',
  },
}

export const STAGE_ORDER: Stage[] = [
  Stage.TODO,
  Stage.BRAINSTORMING,
  Stage.PLANNING,
  Stage.READY,
  Stage.EXECUTING,
  Stage.CODE_REVIEW,
  Stage.DONE,
]
