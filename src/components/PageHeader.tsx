'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { type ReactNode } from 'react'
import { GlobalWeekSelector } from '@/components/GlobalWeekSelector'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#D4CBC0] bg-[rgba(242,237,232,.97)] px-5 backdrop-blur-[48px]">
      <SidebarTrigger className="text-[#7A6A60] hover:text-[#6B4C4C] transition-colors" />
      <div className="flex-1 min-w-0">
        <h1 className="font-['DM_Sans'] text-[15px] font-[600] text-[#2A1F1A] leading-tight tracking-[-0.01em]">
          {title}
        </h1>
        {description && (
          <p className="caption truncate">{description}</p>
        )}
      </div>
      {/* Extra page-specific actions (non-week) */}
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      {/* Global week selector — always visible */}
      <GlobalWeekSelector />
    </header>
  )
}
