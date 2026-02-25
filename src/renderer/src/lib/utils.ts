/**
 * Map Jenkins color to status info
 */
export function colorToStatus(color: string): {
  label: string
  class: string
  dotClass: string
} {
  const isAnimated = color?.endsWith('_anime')
  const baseColor = color?.replace('_anime', '') || 'notbuilt'

  const map: Record<string, { label: string; class: string; dotClass: string }> = {
    blue: {
      label: isAnimated ? 'Running' : 'Success',
      class: isAnimated ? 'text-blue-400' : 'text-emerald-400',
      dotClass: isAnimated ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'
    },
    green: {
      label: isAnimated ? 'Running' : 'Success',
      class: isAnimated ? 'text-blue-400' : 'text-emerald-400',
      dotClass: isAnimated ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'
    },
    red: {
      label: isAnimated ? 'Running (prev failed)' : 'Failed',
      class: isAnimated ? 'text-blue-400' : 'text-red-400',
      dotClass: isAnimated ? 'bg-blue-400 animate-pulse' : 'bg-red-400'
    },
    yellow: {
      label: isAnimated ? 'Running (unstable)' : 'Unstable',
      class: isAnimated ? 'text-blue-400' : 'text-amber-400',
      dotClass: isAnimated ? 'bg-blue-400 animate-pulse' : 'bg-amber-400'
    },
    aborted: {
      label: 'Aborted',
      class: 'text-slate-400',
      dotClass: 'bg-slate-400'
    },
    disabled: {
      label: 'Disabled',
      class: 'text-slate-500',
      dotClass: 'bg-slate-600'
    },
    notbuilt: {
      label: 'Not Built',
      class: 'text-slate-500',
      dotClass: 'bg-slate-600'
    }
  }

  return (
    map[baseColor] || {
      label: color || 'Unknown',
      class: 'text-slate-400',
      dotClass: 'bg-slate-500'
    }
  )
}

/**
 * Map build result to visual styling
 */
export function resultToStyle(result?: string): {
  label: string
  class: string
  bgClass: string
} {
  const map: Record<string, { label: string; class: string; bgClass: string }> = {
    SUCCESS: {
      label: 'Success',
      class: 'text-emerald-400',
      bgClass: 'bg-emerald-400/10 border-emerald-400/20'
    },
    FAILURE: {
      label: 'Failed',
      class: 'text-red-400',
      bgClass: 'bg-red-400/10 border-red-400/20'
    },
    UNSTABLE: {
      label: 'Unstable',
      class: 'text-amber-400',
      bgClass: 'bg-amber-400/10 border-amber-400/20'
    },
    ABORTED: {
      label: 'Aborted',
      class: 'text-slate-400',
      bgClass: 'bg-slate-400/10 border-slate-400/20'
    }
  }

  if (!result) {
    return {
      label: 'Running',
      class: 'text-blue-400',
      bgClass: 'bg-blue-400/10 border-blue-400/20'
    }
  }

  return (
    map[result] || {
      label: result,
      class: 'text-slate-400',
      bgClass: 'bg-slate-400/10 border-slate-400/20'
    }
  )
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '-'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * Format timestamp to relative time
 */
export function timeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

/**
 * Format timestamp to locale string
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Extract folder and job name from fullname
 */
export function parseFullname(fullname: string): { folder: string; name: string } {
  const parts = fullname.split('/')
  const name = parts.pop() || fullname
  const folder = parts.join('/')
  return { folder, name }
}

/**
 * Group jobs by top-level folder
 */
export function groupByFolder(items: JenkinsItem[]): Record<string, JenkinsItem[]> {
  const groups: Record<string, JenkinsItem[]> = {}
  for (const item of items) {
    const folder = item.fullname.split('/')[0] || 'Other'
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(item)
  }
  return groups
}

/**
 * Group jobs hierarchically: Folder → Job → Branch
 * fullname format: "FOLDER/job-name/branch" or "FOLDER/job-name"
 */
export interface BranchGroup {
  folder: string
  job: string
  branches: JenkinsItem[]
}

export interface FolderGroup {
  folder: string
  jobs: BranchGroup[]
  allItems: JenkinsItem[]
}

export function groupHierarchically(items: JenkinsItem[]): FolderGroup[] {
  const folderMap = new Map<string, Map<string, JenkinsItem[]>>()

  for (const item of items) {
    const parts = item.fullname.split('/')
    const folder = parts[0] || 'Other'
    // If 3+ segments: folder/job/branch. If 2: folder/job (job is the leaf). If 1: just a job.
    const jobName = parts.length >= 3 ? parts.slice(1, -1).join('/') : (parts.length === 2 ? parts[1] : parts[0])

    if (!folderMap.has(folder)) folderMap.set(folder, new Map())
    const jobMap = folderMap.get(folder)!
    if (!jobMap.has(jobName)) jobMap.set(jobName, [])
    jobMap.get(jobName)!.push(item)
  }

  const result: FolderGroup[] = []
  for (const [folder, jobMap] of [...folderMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const jobs: BranchGroup[] = []
    const allItems: JenkinsItem[] = []
    for (const [job, branches] of [...jobMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      jobs.push({ folder, job, branches })
      allItems.push(...branches)
    }
    result.push({ folder, jobs, allItems })
  }
  return result
}

/**
 * Status priority for sorting: failed first, then running, then unstable, etc.
 */
function colorPriority(color: string): number {
  const base = color?.replace('_anime', '') || 'notbuilt'
  const isAnimated = color?.endsWith('_anime')
  // Failed running > Failed > Running > Unstable > Success > rest
  if (base === 'red' && isAnimated) return 0
  if (base === 'red') return 1
  if (isAnimated) return 2
  if (base === 'yellow') return 3
  if (base === 'blue' || base === 'green') return 4
  if (base === 'aborted') return 5
  return 6
}

/**
 * Sort jobs by status priority (failed first), then alphabetically by name
 */
export function sortJobsByStatus(items: JenkinsItem[]): JenkinsItem[] {
  return [...items].sort((a, b) => {
    const pa = colorPriority(a.color)
    const pb = colorPriority(b.color)
    if (pa !== pb) return pa - pb
    return a.fullname.localeCompare(b.fullname)
  })
}

/**
 * Sort folder groups with pinned folders first, then alphabetically
 */
export function sortFolderGroups(groups: FolderGroup[], pinned: string[]): FolderGroup[] {
  const pinnedSet = new Set(pinned)
  return [...groups].sort((a, b) => {
    const aPin = pinnedSet.has(a.folder)
    const bPin = pinnedSet.has(b.folder)
    if (aPin && !bPin) return -1
    if (!aPin && bPin) return 1
    if (aPin && bPin) return pinned.indexOf(a.folder) - pinned.indexOf(b.folder)
    return a.folder.localeCompare(b.folder)
  })
}

/**
 * Simple ANSI to HTML converter for Jenkins console output
 */
export function ansiToHtml(text: string): string {
  // Strip Jenkins-specific markers
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Map ANSI codes to CSS classes
  const ansiMap: Record<string, string> = {
    '0': '</span>',
    '1': '<span class="ansi-bold">',
    '30': '<span class="text-slate-600">',
    '31': '<span class="ansi-red">',
    '32': '<span class="ansi-green">',
    '33': '<span class="ansi-yellow">',
    '34': '<span class="ansi-blue">',
    '35': '<span class="ansi-magenta">',
    '36': '<span class="ansi-cyan">',
    '37': '<span class="ansi-white">',
    '91': '<span class="ansi-bright-red">',
    '92': '<span class="ansi-bright-green">',
    '93': '<span class="ansi-bright-yellow">',
    '94': '<span class="ansi-bright-blue">'
  }

  // Replace ANSI escape sequences
  html = html.replace(/\x1b\[([0-9;]+)m/g, (_, codes: string) => {
    return codes
      .split(';')
      .map((code) => ansiMap[code] || '')
      .join('')
  })

  // Clean up any remaining escape sequences
  html = html.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')

  return html
}
