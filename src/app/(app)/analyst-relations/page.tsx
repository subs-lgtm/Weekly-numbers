'use client'

import { SectionShell } from '@/components/SectionShell'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://week-roll-control.lovable.app'

export default function Page() {
  const { weekStart } = useWeek()
  return (
    <SectionShell title="Analyst Relations" description="Analyst engagement and insights dashboard">
      <div className="space-y-4">
        <DomainRatingSlider sectionKey="analyst-relations" weekStart={weekStart} sectionLabel="Analyst Relations" />
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 220px)' }}>
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Analyst Relations Dashboard"
          />
        </div>
      </div>
    </SectionShell>
  )
}
