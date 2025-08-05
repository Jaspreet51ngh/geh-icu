"use client"

interface VitalsChartProps {
  data: number[]
}

export function VitalsChart({ data }: VitalsChartProps) {
  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue || 1

  return (
    <div className="w-full h-16 relative">
      <svg className="w-full h-full" viewBox="0 0 200 60">
        <defs>
          <linearGradient id="vitalsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="15" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 15" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Data line */}
        <path
          d={data
            .map((value, index) => {
              const x = (index / (data.length - 1)) * 200
              const y = 60 - ((value - minValue) / range) * 50
              return `${index === 0 ? "M" : "L"} ${x} ${y}`
            })
            .join(" ")}
          stroke="url(#vitalsGradient)"
          strokeWidth="2"
          fill="none"
        />

        {/* Data points */}
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * 200
          const y = 60 - ((value - minValue) / range) * 50
          return <circle key={index} cx={x} cy={y} r="2" fill="#1d4ed8" stroke="white" strokeWidth="1" />
        })}
      </svg>
    </div>
  )
}
