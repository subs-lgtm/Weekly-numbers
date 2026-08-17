'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { FileUploadGallery } from '@/components/shared/FileUploadGallery'
import { useWeek } from '@/lib/week-context'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['ui-ux']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        <FileUploadGallery sectionKey="ui-ux" />
        <TaskTextBoxes sectionKey="ui-ux" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      </div>
    </SectionShell>
  )
}
