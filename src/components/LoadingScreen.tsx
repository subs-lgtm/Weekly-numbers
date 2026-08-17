'use client'

const spinKeyframes = `@keyframes lyzr-spin { to { transform: rotate(360deg) } }`

export function LoadingScreen() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: spinKeyframes }} />
      <div className="flex flex-col items-center gap-4 rounded-[20px] border border-[#D4CBC0] bg-white p-10 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(107,76,76,0.15)',
            borderTopColor: '#6B4C4C',
            borderRadius: '50%',
            animation: 'lyzr-spin 0.8s linear infinite',
          }}
        />
        <p className="text-[14px] font-[500] text-[#7A6A60]">Loading...</p>
      </div>
    </div>
  )
}
