'use client'

import { SectionShell } from '@/components/SectionShell'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://weekly-growth-hub.lovable.app'

export default function Page() {
  const { weekStart } = useWeek()
  return (
    <SectionShell title="G2" description="G2 reviews, ratings, buyer intent signals, and growth tracking">
      <div className="space-y-4">
        <DomainRatingSlider sectionKey="g2" weekStart={weekStart} sectionLabel="G2" />
        <div
          className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]"
          style={{ height: 'calc(100vh - 220px)' }}
        >
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="G2 Growth Dashboard"
          />
        </div>
        <TaskTextBoxes sectionKey="g2" weekStart={weekStart} />
      </div>
    </SectionShell>
  )
}
