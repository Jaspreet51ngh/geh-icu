"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

interface AgentTimelineProps {
  isOpen: boolean
  onClose: () => void
}

// 🤖 ML MODEL INTEGRATION POINT #4: Agent decision logging
const agentActions = [
  {
    id: 1,
    timestamp: "14:32",
    action: "Bed Optimization",
    description: "Recommended transferring Patient ICU-001 to free bed for incoming trauma case",
    confidence: 0.94,
    status: "completed",
    impact: "High",
    reasoning: "Patient stability score improved to 85%, low readmission risk calculated at 12%",
  },
  {
    id: 2,
    timestamp: "14:28",
    action: "Queue Prioritization",
    description: "Moved cardiac patient (INC-003) up in queue due to deteriorating condition",
    confidence: 0.91,
    status: "active",
    impact: "Critical",
    reasoning: "Cardiac markers trending downward, time-sensitive intervention required",
  },
  {
    id: 3,
    timestamp: "14:25",
    action: "Capacity Alert",
    description: "Triggered high occupancy alert at 92% capacity",
    confidence: 0.98,
    status: "completed",
    impact: "Medium",
    reasoning: "Historical data shows 95%+ occupancy leads to delayed admissions",
  },
  {
    id: 4,
    timestamp: "14:20",
    action: "Transfer Prediction",
    description: "Identified 3 patients likely ready for transfer within 6 hours",
    confidence: 0.87,
    status: "monitoring",
    impact: "High",
    reasoning: "Stability trends and recovery patterns match successful transfer profiles",
  },
  {
    id: 5,
    timestamp: "14:15",
    action: "Resource Allocation",
    description: "Suggested holding elective surgery due to predicted ICU demand spike",
    confidence: 0.82,
    status: "pending",
    impact: "Medium",
    reasoning: "Weekend admission patterns and current queue suggest 98% occupancy by evening",
  },
]

export function AgentTimeline({ isOpen, onClose }: AgentTimelineProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "active":
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case "monitoring":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "pending":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-slate-400" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "Critical":
        return "bg-red-100 text-red-800"
      case "High":
        return "bg-orange-100 text-orange-800"
      case "Medium":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-600" />
            AI Agent Timeline
          </SheetTitle>
          <SheetDescription>Real-time log of AI-powered decisions and recommendations</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-4">
            {agentActions.map((action, index) => (
              <div key={action.id} className="relative">
                {/* Timeline line */}
                {index < agentActions.length - 1 && <div className="absolute left-6 top-12 w-0.5 h-16 bg-slate-200" />}

                <div className="flex gap-4 p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(action.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-slate-800">{action.action}</h3>
                        <p className="text-sm text-slate-600 mt-1">{action.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-500">{action.timestamp}</span>
                        <Badge className={getImpactColor(action.impact)}>{action.impact}</Badge>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-md mb-3">
                      <div className="text-sm text-slate-700">
                        <strong>AI Reasoning:</strong> {action.reasoning}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Confidence:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                              style={{ width: `${action.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">{Math.round(action.confidence * 100)}%</span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          action.status === "completed"
                            ? "border-green-300 text-green-700"
                            : action.status === "active"
                              ? "border-blue-300 text-blue-700"
                              : action.status === "monitoring"
                                ? "border-yellow-300 text-yellow-700"
                                : "border-orange-300 text-orange-700"
                        }`}
                      >
                        {action.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
