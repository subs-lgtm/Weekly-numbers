'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://lyzr-ads-2.lovable.app/'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['gsi-si-founder-amplification']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="gsi-si-founder-amplification" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 280px)' }}>
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="GSI/SI & Founder Amplification Dashboard"
          />
        </div>
      </div>
    </SectionShell>
  )
}
