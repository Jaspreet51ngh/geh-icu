"use client"

interface TrendSparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
}

export function TrendSparkline({ data, width = 60, height = 20, color }: TrendSparklineProps) {
  // Determine trend direction and color
  const isUpward = data[data.length - 1] > data[0]
  const trendColor = color || (isUpward ? "#10b981" : "#ef4444")

  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue || 1

  return (
    <div style={{ width, height }}>
      <svg width="100%" height="100%" viewBox="0 0 60 20">
        <path
          d={data
            .map((value, index) => {
              const x = (index / (data.length - 1)) * 60
              const y = 20 - ((value - minValue) / range) * 20
              return `${index === 0 ? "M" : "L"} ${x} ${y}`
            })
            .join(" ")}
          stroke={trendColor}
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  )
}
