'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import EmergingPartnersDashboard from '@/components/partners/EmergingPartnersDashboard'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['partners-emerging']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="partners-emerging" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <EmergingPartnersDashboard />
        </div>
      </div>
    </SectionShell>
  )
}
