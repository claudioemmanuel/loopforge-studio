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
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/40',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600',
    hex: '#6b7280',
  },
  [Stage.BRAINSTORMING]: {
    label: 'Brainstorming',
    icon: MessageSquare,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-50 dark:bg-violet-900/40',
    textColor: 'text-violet-700 dark:text-violet-300',
    borderColor: 'border-violet-300 dark:border-violet-600',
    hex: '#8b5cf6',
  },
  [Stage.PLANNING]: {
    label: 'Planning',
    icon: FileText,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-600',
    hex: '#3b82f6',
  },
  [Stage.READY]: {
    label: 'Ready',
    icon: Zap,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/40',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-600',
    hex: '#f59e0b',
  },
  [Stage.EXECUTING]: {
    label: 'Executing',
    icon: Play,
    color: 'bg-teal-500',
    bgColor: 'bg-teal-50 dark:bg-teal-900/40',
    textColor: 'text-teal-700 dark:text-teal-300',
    borderColor: 'border-teal-300 dark:border-teal-600',
    hex: '#14b8a6',
  },
  [Stage.CODE_REVIEW]: {
    label: 'Code Review',
    icon: GitPullRequest,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/40',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-600',
    hex: '#f97316',
  },
  [Stage.DONE]: {
    label: 'Done',
    icon: CheckCircle2,
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-600',
    hex: '#22c55e',
  },
  [Stage.STUCK]: {
    label: 'Stuck',
    icon: AlertTriangle,
    color: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/40',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-600',
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
