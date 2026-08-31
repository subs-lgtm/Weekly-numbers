'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SectionShell } from '@/components/SectionShell'

// Public, non-SSO-gated alias for the "lyzr-performance-pipeline-report" Vercel project. The
// scope-suffixed default domain (lyzr-performance-pipeline-report-subs-3909s-projects.vercel.app)
// sits behind Vercel's deployment-protection SSO wall and sends X-Frame-Options: DENY — this
// clean project alias does neither (confirmed via curl -sI before embedding).
const EMBED_URL = 'https://lyzr-performance-pipeline-report.vercel.app'

export default function AdsPerformanceReportPage() {
  return (
    <SectionShell
      title="3-Month Ads Performance"
      description="Jun–Aug 2026 performance & pipeline report"
    >
      <div className="space-y-4">
        <Link href="/ads" className="inline-flex items-center gap-1.5 text-[13px] text-[#6B4C4C] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Ads
        </Link>
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 220px)' }}>
          <iframe
            src={EMBED_URL}
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="3-Month Ads Performance Report"
          />
        </div>
      </div>
    </SectionShell>
  )
}
