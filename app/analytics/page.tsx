"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Clock, AlertTriangle, Calendar } from "lucide-react"

// Simple bar chart component
function SimpleBarChart({ data, title }: { data: any[]; title: string }) {
  const maxValue = Math.max(...data.map((d) => d.utilization || d.avgDelay || d.cancelled || 0))

  return (
    <div className="w-full h-64 p-4">
      <div className="h-full flex items-end justify-between gap-2">
        {data.map((item, index) => {
          const value = item.utilization || item.avgDelay || item.cancelled || 0
          const height = (value / maxValue) * 100

          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className="w-full bg-teal-500 rounded-t-sm min-h-[4px] transition-all duration-300 hover:bg-teal-600"
                style={{ height: `${height}%` }}
              />
              <div className="text-xs text-slate-600 mt-2 text-center">{item.day || item.hour || item.month}</div>
              <div className="text-xs font-medium text-slate-800">
                {value}
                {title.includes("utilization") ? "%" : title.includes("delay") ? "min" : ""}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Dummy data for charts
const utilizationData = [
  { day: "Mon", utilization: 88 },
  { day: "Tue", utilization: 92 },
  { day: "Wed", utilization: 85 },
  { day: "Thu", utilization: 94 },
  { day: "Fri", utilization: 89 },
  { day: "Sat", utilization: 91 },
  { day: "Sun", utilization: 87 },
]

const transferDelayData = [
  { hour: "00:00", avgDelay: 45 },
  { hour: "04:00", avgDelay: 32 },
  { hour: "08:00", avgDelay: 67 },
  { hour: "12:00", avgDelay: 89 },
  { hour: "16:00", avgDelay: 78 },
  { hour: "20:00", avgDelay: 56 },
]

const cancelledSurgeriesData = [
  { month: "Jan", cancelled: 3 },
  { month: "Feb", cancelled: 5 },
  { month: "Mar", cancelled: 2 },
  { month: "Apr", cancelled: 7 },
  { month: "May", cancelled: 4 },
  { month: "Jun", cancelled: 6 },
]

export default function Analytics() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">ICU Analytics Dashboard</h1>
        <p className="text-slate-600">Performance metrics and operational insights</p>
      </div>

      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Avg ICU Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">89.4%</div>
              <p className="text-xs text-slate-600">+2.1% from last week</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Avg Transfer Delay</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">3.2 hrs</div>
              <p className="text-xs text-slate-600">-0.8 hrs from last week</p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Transfer Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">94.7%</div>
              <p className="text-xs text-slate-600">+1.2% from last week</p>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Cancelled Surgeries</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">6</div>
              <p className="text-xs text-slate-600">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ICU Utilization Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-800">ICU Utilization Over Time</CardTitle>
              <CardDescription>Weekly utilization percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={utilizationData} title="utilization" />
            </CardContent>
          </Card>

          {/* Transfer Delays Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-800">ED to ICU Transfer Delays</CardTitle>
              <CardDescription>Average delay by time of day (minutes)</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={transferDelayData} title="delay" />
            </CardContent>
          </Card>

          {/* Cancelled Surgeries Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-slate-800">Cancelled Elective Surgeries</CardTitle>
              <CardDescription>Due to ICU bed unavailability</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={cancelledSurgeriesData} title="cancelled" />
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              Performance Insights
            </CardTitle>
            <CardDescription>AI-generated recommendations based on current trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-blue-900">Peak Hour Optimization</div>
                <div className="text-sm text-blue-700">
                  Transfer delays are highest between 12:00-16:00. Consider scheduling non-urgent transfers during
                  off-peak hours.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium text-green-900">Capacity Management</div>
                <div className="text-sm text-green-700">
                  Current utilization trends suggest maintaining 8-10% buffer capacity to handle emergency admissions
                  effectively.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-medium text-orange-900">Surgery Scheduling</div>
                <div className="text-sm text-orange-700">
                  6 elective surgeries cancelled this month. Consider implementing predictive scheduling based on ICU
                  availability forecasts.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
