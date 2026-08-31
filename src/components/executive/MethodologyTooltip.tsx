'use client'

import type { ReactNode } from 'react'

/**
 * Extracted from the group-hover tooltip markup in src/components/mql/MQLJourneyFunnel.tsx —
 * reused ~13+ times across the Executive Dashboard's KPI cards/table columns, so it's worth one
 * shared component instead of copy-pasting the markup at every call site.
 */
export function MethodologyTooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group select-none">
      <span className="cursor-help border-b border-dashed border-[#7A6A60]/40 pb-0.5">
        {children}
      </span>
      <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 bg-[#2A1F1A] text-white text-[11px] p-3 rounded-lg shadow-lg border border-[#5C4E46] leading-relaxed text-left normal-case font-[400]">
        {text}
        <span className="absolute top-full left-4 border-4 border-transparent border-t-[#2A1F1A]" />
      </span>
    </span>
  )
}
