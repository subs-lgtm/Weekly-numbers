'use client'

import { SectionShell } from '@/components/SectionShell'

export default function Page() {
  return (
    <SectionShell title="Architect / DevRel" description="DevRel weekly numbers — embedded from external dashboard">
      <div className="w-full rounded-[20px] border border-[#E8E0D8] overflow-hidden bg-white" style={{ height: 'calc(100vh - 200px)', minHeight: '700px' }}>
        <iframe
          src="https://devrel-weekly-numbers.lovable.app/"
          className="w-full h-full border-0"
          allow="fullscreen"
          title="DevRel Weekly Numbers"
        />
      </div>
    </SectionShell>
  )
}
