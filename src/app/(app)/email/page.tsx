'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://email-marketing-lyzr.lovable.app/'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['email']
  return (
    <SectionShell title={section?.label || "Email Marketing"} description={section?.description || "Email marketing dashboard"}>
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="email" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 280px)' }}>
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Email Marketing Dashboard"
          />
        </div>
      </div>
    </SectionShell>
  )
}
