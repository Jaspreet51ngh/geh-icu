"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, AlertTriangle, Zap, Brain } from "lucide-react"

// 🤖 ML MODEL INTEGRATION POINT #5: Predictive analytics data
const forecastData = {
  occupancyForecast: [
    { time: "Now", predicted: 92 },
    { time: "1hr", predicted: 94 },
    { time: "2hr", predicted: 96 },
    { time: "3hr", predicted: 98 },
    { time: "4hr", predicted: 95 },
    { time: "5hr", predicted: 91 },
    { time: "6hr", predicted: 88 },
  ],

  riskAlerts: [
    {
      time: "16:30",
      type: "Capacity Risk",
      severity: "high",
      message: "Predicted 98% occupancy - consider expediting 2 transfers",
      probability: 0.87,
    },
    {
      time: "18:00",
      type: "Staffing Alert",
      severity: "medium",
      message: "Evening shift may need additional nurse due to high acuity",
      probability: 0.73,
    },
    {
      time: "19:30",
      type: "Equipment Alert",
      severity: "low",
      message: "Ventilator availability may be limited",
      probability: 0.45,
    },
  ],

  transferOpportunities: [
    {
      patientId: "ICU-001",
      name: "Sarah Johnson",
      transferWindow: "Next 2 hours",
      confidence: 0.89,
      reason: "Optimal stability window predicted",
    },
    {
      patientId: "ICU-004",
      name: "David Thompson",
      transferWindow: "Next 4 hours",
      confidence: 0.94,
      reason: "Recovery trajectory exceeds expectations",
    },
    {
      patientId: "ICU-006",
      name: "Robert Kim",
      transferWindow: "Next 6 hours",
      confidence: 0.82,
      reason: "Stable trend with low readmission risk",
    },
  ],
}

// Simple CSS-based chart component
function SimpleLineChart({ data }: { data: { time: string; predicted: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.predicted))
  const minValue = Math.min(...data.map((d) => d.predicted))
  const range = maxValue - minValue

  return (
    <div className="w-full h-64 p-4 bg-slate-50 rounded-lg">
      <div className="relative h-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-500">
          <span>{maxValue}%</span>
          <span>{Math.round((maxValue + minValue) / 2)}%</span>
          <span>{minValue}%</span>
        </div>

        {/* Chart area */}
        <div className="ml-8 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-slate-200" />
            ))}
          </div>

          {/* Data points and line */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Line path */}
            <path
              d={data
                .map((point, index) => {
                  const x = (index / (data.length - 1)) * 100
                  const y = 100 - ((point.predicted - minValue) / range) * 100
                  return `${index === 0 ? "M" : "L"} ${x}% ${y}%`
                })
                .join(" ")}
              stroke="url(#lineGradient)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="8 4"
            />

            {/* Data points */}
            {data.map((point, index) => {
              const x = (index / (data.length - 1)) * 100
              const y = 100 - ((point.predicted - minValue) / range) * 100
              return (
                <circle key={index} cx={`${x}%`} cy={`${y}%`} r="4" fill="#0891b2" stroke="white" strokeWidth="2" />
              )
            })}
          </svg>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500 mt-2">
            {data.map((point, index) => (
              <span key={index} className="transform -translate-x-1/2">
                {point.time}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ForecastPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-6 w-6 text-teal-600" />
        <h2 className="text-2xl font-bold text-slate-800">6-Hour ICU Forecast</h2>
        <Badge className="bg-teal-100 text-teal-800">
          <Brain className="h-3 w-3 mr-1" />
          AI Powered
        </Badge>
      </div>

      {/* Risk Alerts */}
      <div className="space-y-3">
        {forecastData.riskAlerts.map((alert, index) => (
          <Alert
            key={index}
            className={`${
              alert.severity === "high"
                ? "border-red-200 bg-red-50"
                : alert.severity === "medium"
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-blue-200 bg-blue-50"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${
                alert.severity === "high"
                  ? "text-red-600"
                  : alert.severity === "medium"
                    ? "text-yellow-600"
                    : "text-blue-600"
              }`}
            />
            <AlertDescription
              className={`${
                alert.severity === "high"
                  ? "text-red-800"
                  : alert.severity === "medium"
                    ? "text-yellow-800"
                    : "text-blue-800"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <strong>
                    {alert.type} ({alert.time}):
                  </strong>{" "}
                  {alert.message}
                </div>
                <Badge variant="outline" className="ml-2">
                  {Math.round(alert.probability * 100)}% confidence
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Forecast Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              ICU Occupancy Forecast
            </CardTitle>
            <CardDescription>Predicted occupancy levels for the next 6 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={forecastData.occupancyForecast} />
          </CardContent>
        </Card>

        {/* Transfer Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-teal-600" />
              Transfer Opportunities
            </CardTitle>
            <CardDescription>AI-identified optimal transfer windows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forecastData.transferOpportunities.map((opportunity) => (
              <div key={opportunity.patientId} className="p-4 border border-slate-200 rounded-lg bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-slate-800">{opportunity.name}</div>
                    <div className="text-sm text-slate-600">{opportunity.patientId}</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {Math.round(opportunity.confidence * 100)}% confidence
                  </Badge>
                </div>
                <div className="text-sm text-slate-700 mb-2">{opportunity.reason}</div>
                <div className="text-sm text-teal-700 font-medium">Optimal window: {opportunity.transferWindow}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
