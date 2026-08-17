'use client'

import { SectionShell } from '@/components/SectionShell'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://weekflow-studio.lovable.app'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['podcasts']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-4">
        <DomainRatingSlider sectionKey="podcasts" weekStart={weekStart} sectionLabel={section.label} />
        <div
          className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]"
          style={{ height: 'calc(100vh - 220px)' }}
        >
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Podcasts & Reach Out Dashboard"
          />
        </div>
        <TaskTextBoxes sectionKey="podcasts" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      </div>
    </SectionShell>
  )
}
