'use client'

import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { AwsPartnerTrackerCard } from '@/components/partners/AwsPartnerTrackerCard'
import { useWeek } from '@/lib/week-context'

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['partners-aws']
  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-4">
        <DomainRatingSlider sectionKey="partners-aws" weekStart={weekStart} sectionLabel={section.label} />
        <AwsPartnerTrackerCard />
      </div>
    </SectionShell>
  )
}
