'use client'

import { SectionShell } from '@/components/SectionShell'

const EMBED_URL = 'https://data-cheer-up.lovable.app/'

export default function Page() {
  return (
    <SectionShell title="Socials" description="LinkedIn, X and Reddit performance">
      <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 160px)' }}>
        <iframe
          src={EMBED_URL}
          className="w-full h-full"
          style={{ border: 'none', display: 'block' }}
          allow="fullscreen"
          title="Socials Dashboard"
        />
      </div>
    </SectionShell>
  )
}
