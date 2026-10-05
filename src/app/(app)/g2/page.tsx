'use client'

import { SectionShell } from '@/components/SectionShell'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { InlineMetricTable } from '@/components/InlineMetricTable'
import { G2ClickBreakdown } from '@/components/g2/G2ClickBreakdown'
import { G2BuyerIntent } from '@/components/g2/G2BuyerIntent'
import { useWeek } from '@/lib/week-context'
import { SECTION_MAP } from '@/lib/metrics-config'

const EMBED_URL = 'https://weekly-growth-hub.lovable.app'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['g2']
  return (
    <SectionShell title="G2" description="G2 reviews, ratings, buyer intent signals, and growth tracking">
      <div className="space-y-4">
        <DomainRatingSlider sectionKey="g2" weekStart={weekStart} sectionLabel="G2" />

        {/* G2 ad click analytics — manual for now (typed in from a G2 export), same pattern as
            every other InlineMetricTable section, until G2 API access lets this pull live. */}
        <div>
          <p className="section-label first">G2 Ad Click Analytics</p>
          <p className="section-sub">Manual for now — enter from the G2 dashboard export each week until API access is wired up.</p>
          <InlineMetricTable sectionKey="g2" metrics={section.metrics} weekStart={weekStart} />
          <div className="mt">
            <G2ClickBreakdown weekStart={weekStart} />
          </div>
          <div className="mt">
            <G2BuyerIntent weekStart={weekStart} />
          </div>
        </div>

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
