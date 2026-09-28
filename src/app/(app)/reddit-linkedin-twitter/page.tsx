'use client'

import { SectionShell } from '@/components/SectionShell'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const EMBED_URL = 'https://data-cheer-up.lovable.app'

export default function Page() {
  const { weekStart } = useWeek()
  return (
    <SectionShell title="Reddit, LinkedIn, Twitter" description="Social channel performance across Reddit, LinkedIn, and Twitter/X">
      <div className="space-y-6">
        <TaskTextBoxes sectionKey="reddit-linkedin-twitter" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
        <div
          className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]"
          style={{ height: 'calc(100vh - 220px)' }}
        >
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Reddit, LinkedIn, Twitter Dashboard"
          />
        </div>
      </div>
    </SectionShell>
  )
}
