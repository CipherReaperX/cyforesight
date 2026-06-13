import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDate(date: string | Date, formatStr: string = 'MMM dd, yyyy HH:mm'): string {
  return format(new Date(date), formatStr)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'text-red-500 bg-red-500/10 border-red-500/20',
    high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    low: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    info: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
  }
  return colors[severity.toLowerCase()] || colors.info
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-500',
    blocked: 'text-red-500',
    whitelisted: 'text-blue-500',
    archived: 'text-gray-500',
  }
  return colors[status.toLowerCase()] || 'text-gray-500'
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'bg-green-500'
  if (confidence >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

