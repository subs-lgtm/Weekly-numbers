'use client'

import { SectionShell } from '@/components/SectionShell'
import { OKRSection } from '@/components/summary/OKRSection'

export default function Page() {
  return (
    <SectionShell title="OKR's" description="Objectives & Key Results — Q3 2026">
      <OKRSection />
    </SectionShell>
  )
}
