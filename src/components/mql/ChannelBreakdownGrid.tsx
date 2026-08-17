'use client'

import { useMemo } from 'react'

const CHANNEL_COLORS: Record<string, string> = {
  'Paid Campaigns': '#6B4C4C',
  'Direct':         '#C96A5A',
  'Organic Search': '#4A7C7C',
  'Social':         '#8C7CA0',
  'Referral':       '#C4A84A',
  'Email':          '#5A8C6A',
  'LLM':            '#7C6A4A',
  'G2':             '#A06A8C',
  'Other':          '#BCACA2',
}

function getColor(name: string) {
  return CHANNEL_COLORS[name] || CHANNEL_COLORS['Other']
}

// Merge "Content / Organic" into "Organic Search" for display
function mergeCategories(raw: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = {}
  for (const [key, val] of Object.entries(raw)) {
    const displayKey = key === 'Content / Organic' ? 'Organic Search' : key
    merged[displayKey] = (merged[displayKey] || 0) + val
  }
  return merged
}


type Props = {
  bySourceCategory: Record<string, number>
  total: number
}

export function ChannelBreakdownGrid({ bySourceCategory, total }: Props) {
  const merged = mergeCategories(bySourceCategory)

  const rows = useMemo(() => {
    return Object.entries(merged)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
  }, [merged])

  if (rows.length === 0) return null

  const maxVal = Math.max(...rows.map(([, v]) => v), 1)

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-[12px] font-[600] text-[#7A6A60] uppercase tracking-wider">Channel-wise Breakdown</h3>
        <p className="text-[20px] font-[700] text-[#2A1F1A] font-['Playfair_Display'] mt-1">
          {total} total MQLs across {rows.length} {rows.length === 1 ? 'channel' : 'channels'}
        </p>
      </div>

      <div>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 56px 52px',
            gap: '8px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid #E8E0D8',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#7A6A60', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Channel</span>
            <span />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#7A6A60', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Count</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#7A6A60', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Share</span>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {rows.map(([name, value]) => {
              const barPct = Math.max((value / maxVal) * 100, value > 0 ? 3 : 0)
              const share = total > 0 ? Math.round((value / total) * 100) : 0
              const color = getColor(name)

              return (
                <div key={name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 56px 52px', gap: '8px', alignItems: 'center' }}>
                  {/* Channel name */}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#2A1F1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                  </span>

                  {/* Bar */}
                  <div style={{ background: '#F0EAE4', borderRadius: 6, height: 28, position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      width: `${barPct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 8,
                      transition: 'width 0.5s ease',
                    }}>
                      {barPct > 15 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{value}</span>
                      )}
                    </div>
                    {barPct <= 15 && value > 0 && (
                      <span style={{
                        position: 'absolute',
                        left: `calc(${barPct}% + 6px)`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#2A1F1A',
                      }}>{value}</span>
                    )}
                  </div>

                  {/* Count */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2A1F1A', textAlign: 'right' }}>
                    {value.toLocaleString()}
                  </span>

                  {/* Share */}
                  <span style={{ fontSize: 13, fontWeight: 600, color, textAlign: 'right' }}>
                    {share}%
                  </span>
                </div>
              )
            })}
          </div>
      </div>
    </div>
  )
}
