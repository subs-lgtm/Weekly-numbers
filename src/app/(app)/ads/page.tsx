'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://ad-insight-dream.lovable.app/'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['ads']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="ads" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" showRating={false} />
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 160px)' }}>
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Ads Insights Dashboard"
          />
        </div>
      </div>
    </SectionShell>
  )
}
