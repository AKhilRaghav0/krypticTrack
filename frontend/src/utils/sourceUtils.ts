import { Globe, Code, Desktop } from '@phosphor-icons/react'

export type SourceIcon = typeof Globe | typeof Code | typeof Desktop

export interface SourceColors {
  text: string
  bg: string
}

/**
 * Get the appropriate icon for a source
 */
export function getSourceIcon(source: string): SourceIcon {
  switch (source) {
    case 'chrome':
      return Globe
    case 'vscode':
      return Code
    case 'system':
      return Desktop
    default:
      return Desktop
  }
}

/**
 * Get color classes for a source (for components that need separate text/bg)
 */
export function getSourceColors(source: string): SourceColors {
  if (source === 'chrome') {
    return { text: 'text-tertiary-600', bg: 'bg-tertiary-50' }
  } else if (source === 'vscode') {
    return { text: 'text-primary-500', bg: 'bg-primary-50' }
  } else if (source === 'system') {
    return { text: 'text-secondary-500', bg: 'bg-secondary-50' }
  }
  return { text: 'text-gray-600', bg: 'bg-gray-50' }
}

/**
 * Get color classes for a source (single string format for simpler components)
 */
export function getSourceColor(source: string): string {
  if (source === 'chrome') {
    return 'bg-tertiary-50 text-tertiary-600'
  } else if (source === 'vscode') {
    return 'bg-primary-50 text-primary-500'
  } else if (source === 'system') {
    return 'bg-secondary-50 text-secondary-500'
  }
  return 'bg-gray-50 text-gray-600'
}

/**
 * Format action type to readable label
 */
export function formatActionType(actionType: string): string {
  const labels: Record<string, string> = {
    'app_switch': 'App Switch',
    'idle_detection': 'Idle Period',
    'screen_time': 'Screen Time',
    'dom_change': 'Page Change',
    'click': 'Click',
    'keypress': 'Key Press',
    'mouse_enter': 'Mouse Enter',
    'mouse_leave': 'Mouse Leave',
  }
  return labels[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}




