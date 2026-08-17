'use client'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['experiments-videos']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="experiments-videos" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      </div>
    </SectionShell>
  )
}
