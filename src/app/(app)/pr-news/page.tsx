'use client'

import { SectionShell } from '@/components/SectionShell'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import { SECTION_MAP } from '@/lib/metrics-config'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['pr-news']
  return (
    <SectionShell title={section.label} description={section.description}>
      <TaskTextBoxes
        sectionKey="pr-news"
        weekStart={weekStart}
        lastWeekKey="tasks_last_week"
        thisWeekKey="tasks_this_week"
        lastWeekLabel="Done Last Week"
        thisWeekLabel="To Do This Week"
      />
    </SectionShell>
  )
}
