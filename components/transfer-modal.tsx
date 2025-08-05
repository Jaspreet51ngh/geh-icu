"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, User, Calendar, Activity } from "lucide-react"

interface Patient {
  id: string
  name: string
  icuDays: number
  stabilityScore: number
  status: string
  statusColor: string
}

interface TransferModalProps {
  patient: Patient | null
  isOpen: boolean
  onClose: () => void
}

const transferSteps = [
  {
    id: 1,
    title: "Receiving Ward Notified",
    status: "completed",
    icon: CheckCircle,
    color: "text-green-600",
    timestamp: "14:32",
  },
  {
    id: 2,
    title: "Doctor Approval Confirmed",
    status: "completed",
    icon: CheckCircle,
    color: "text-green-600",
    timestamp: "14:45",
  },
  {
    id: 3,
    title: "Bed Cleaning in Progress",
    status: "in-progress",
    icon: Clock,
    color: "text-yellow-600",
    timestamp: "In progress",
  },
  {
    id: 4,
    title: "Transport Scheduled",
    status: "pending",
    icon: AlertCircle,
    color: "text-slate-400",
    timestamp: "Pending",
  },
]

export function TransferModal({ patient, isOpen, onClose }: TransferModalProps) {
  if (!patient) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <User className="h-5 w-5 text-teal-600" />
            Patient Transfer Details
          </DialogTitle>
          <DialogDescription>
            Transfer progress for {patient.name} ({patient.id})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Summary */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-600">Patient ID</div>
                <div className="font-medium text-slate-800">{patient.id}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">ICU Days</div>
                <div className="font-medium text-slate-800">{patient.icuDays}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">Stability Score</div>
                <div className="font-medium text-slate-800">{patient.stabilityScore}%</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">Status</div>
                <Badge className={patient.statusColor}>{patient.status}</Badge>
              </div>
            </div>
          </div>

          {/* Transfer Timeline */}
          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-600" />
              Transfer Progress
            </h3>
            <div className="space-y-4">
              {transferSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-medium ${
                          step.status === "completed"
                            ? "text-slate-800"
                            : step.status === "in-progress"
                              ? "text-slate-800"
                              : "text-slate-500"
                        }`}
                      >
                        {step.title}
                      </p>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {step.timestamp}
                      </span>
                    </div>
                    {step.status === "in-progress" && (
                      <div className="mt-1">
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div className="bg-yellow-500 h-1.5 rounded-full w-2/3 animate-pulse"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated Completion */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Estimated Transfer Completion</span>
            </div>
            <div className="text-lg font-semibold text-blue-900">Today, 16:30</div>
            <div className="text-sm text-blue-700">Approximately 45 minutes remaining</div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              Close
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">Update Status</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
