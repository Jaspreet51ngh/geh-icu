"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, Brain, AlertTriangle, Users, ArrowUp, ArrowDown, Pause } from "lucide-react"

const queueData = [
  {
    id: "INC-001",
    caseType: "Trauma",
    patientName: "John Doe",
    eta: "15 min",
    severity: 95,
    aiSuggestion: "Clear Bed 12",
    priority: "high",
    canHold: false,
    estimatedStay: "3-5 days",
    riskFactors: ["Multiple injuries", "Unstable vitals"],
    mlConfidence: 0.94,
  },
  {
    id: "INC-002",
    caseType: "Post-Op",
    patientName: "Jane Smith",
    eta: "45 min",
    severity: 78,
    aiSuggestion: "Clear Bed 8",
    priority: "medium",
    canHold: true,
    estimatedStay: "1-2 days",
    riskFactors: ["Routine recovery"],
    mlConfidence: 0.87,
  },
  {
    id: "INC-003",
    caseType: "Cardiac",
    patientName: "Bob Wilson",
    eta: "1.2 hrs",
    severity: 89,
    aiSuggestion: "Clear Bed 15",
    priority: "high",
    canHold: false,
    estimatedStay: "2-4 days",
    riskFactors: ["Arrhythmia", "Previous MI"],
    mlConfidence: 0.91,
  },
  {
    id: "INC-004",
    caseType: "Respiratory",
    patientName: "Alice Brown",
    eta: "2.5 hrs",
    severity: 72,
    aiSuggestion: "Monitor, can delay 1hr",
    priority: "medium",
    canHold: true,
    estimatedStay: "2-3 days",
    riskFactors: ["COPD exacerbation"],
    mlConfidence: 0.83,
  },
  {
    id: "INC-005",
    caseType: "Neurological",
    patientName: "Chris Lee",
    eta: "3 hrs",
    severity: 85,
    aiSuggestion: "Clear Bed 22",
    priority: "high",
    canHold: false,
    estimatedStay: "4-7 days",
    riskFactors: ["Stroke symptoms", "Time critical"],
    mlConfidence: 0.89,
  },
]

export default function IncomingQueuePage() {
  const [queue, setQueue] = useState(queueData)
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)

  const handlePrioritize = (patientId: string, direction: "up" | "down") => {
    setQueue((prev) => {
      const newQueue = [...prev]
      const currentIndex = newQueue.findIndex((p) => p.id === patientId)

      if (direction === "up" && currentIndex > 0) {
        ;[newQueue[currentIndex], newQueue[currentIndex - 1]] = [newQueue[currentIndex - 1], newQueue[currentIndex]]
      } else if (direction === "down" && currentIndex < newQueue.length - 1) {
        ;[newQueue[currentIndex], newQueue[currentIndex + 1]] = [newQueue[currentIndex + 1], newQueue[currentIndex]]
      }

      return newQueue
    })
  }

  const handleHold = (patientId: string) => {
    setQueue((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, priority: p.priority === "hold" ? "medium" : ("hold" as any) } : p,
      ),
    )
  }

  const highPriorityCount = queue.filter((p) => p.priority === "high").length
  const avgWaitTime = queue.reduce((acc, p) => acc + Number.parseInt(p.eta), 0) / queue.length

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Clock className="h-6 w-6 text-teal-600" />
          Incoming Patient Queue
        </h1>
        <p className="text-slate-600">AI-optimized queue management for ICU admissions</p>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-800">{queue.length}</div>
            <div className="text-sm text-slate-600">Patients in Queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{highPriorityCount}</div>
            <div className="text-sm text-slate-600">High Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{Math.round(avgWaitTime)} min</div>
            <div className="text-sm text-slate-600">Avg Wait Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">94%</div>
            <div className="text-sm text-slate-600">AI Accuracy</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for High Priority Cases */}
      {highPriorityCount >= 3 && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Alert:</strong> {highPriorityCount} high-priority cases in queue. Consider expediting transfers.
          </AlertDescription>
        </Alert>
      )}

      {/* Queue Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-600" />
            AI-Optimized Queue
          </CardTitle>
          <CardDescription>
            Patients are automatically prioritized based on severity, bed availability, and predicted outcomes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {queue.map((patient, index) => (
            <div
              key={patient.id}
              className={`p-6 border rounded-lg transition-all ${
                patient.priority === "high"
                  ? "border-red-300 bg-red-50"
                  : patient.priority === "medium"
                    ? "border-yellow-300 bg-yellow-50"
                    : patient.priority === "hold"
                      ? "border-gray-300 bg-gray-50"
                      : "border-slate-200 bg-white"
              } ${selectedPatient === patient.id ? "ring-2 ring-blue-500" : ""}`}
              onClick={() => setSelectedPatient(selectedPatient === patient.id ? null : patient.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-bold text-slate-600">#{index + 1}</div>
                  <div>
                    <div className="font-semibold text-slate-800">{patient.patientName}</div>
                    <div className="text-sm text-slate-600">
                      {patient.id} • {patient.caseType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`${
                      patient.severity >= 90
                        ? "bg-red-100 text-red-800"
                        : patient.severity >= 80
                          ? "bg-orange-100 text-orange-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    Severity: {patient.severity}
                  </Badge>
                  <Badge
                    className={`${
                      patient.priority === "high"
                        ? "bg-red-100 text-red-800"
                        : patient.priority === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : patient.priority === "hold"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {patient.priority === "hold" ? "On Hold" : `${patient.priority} Priority`}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-slate-600">ETA</div>
                  <div className="font-medium">{patient.eta}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Estimated Stay</div>
                  <div className="font-medium">{patient.estimatedStay}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">AI Confidence</div>
                  <div className="font-medium">{Math.round(patient.mlConfidence * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-teal-700 font-medium flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  AI Recommendation: {patient.aiSuggestion}
                </div>
              </div>

              {/* Risk Factors */}
              <div className="mb-4">
                <div className="text-sm text-slate-600 mb-2">Risk Factors:</div>
                <div className="flex flex-wrap gap-2">
                  {patient.riskFactors.map((factor, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrioritize(patient.id, "up")
                  }}
                  disabled={index === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Move Up
                </Button>

                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrioritize(patient.id, "down")
                  }}
                  disabled={index === queue.length - 1}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Move Down
                </Button>

                {patient.canHold && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleHold(patient.id)
                    }}
                    className={`${
                      patient.priority === "hold"
                        ? "border-green-300 text-green-700 hover:bg-green-50"
                        : "border-orange-300 text-orange-700 hover:bg-orange-50"
                    }`}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    {patient.priority === "hold" ? "Resume" : "Hold"}
                  </Button>
                )}

                <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50">
                  <Users className="h-3 w-3 mr-1" />
                  Assign Bed
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
