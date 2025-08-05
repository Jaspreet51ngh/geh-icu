"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRightLeft,
  User,
  Bed,
  AlertTriangle,
  Brain,
  Lock,
  CheckCircle2,
  Clock,
  Stethoscope,
  Activity,
  Send,
  Hourglass,
} from "lucide-react"
import { MLPredictionService } from "@/lib/ml-service"

interface TransferRequestModalProps {
  patient: any
  isOpen: boolean
  onClose: () => void
  userRole: string
}

export function TransferRequestModal({ patient, isOpen, onClose, userRole }: TransferRequestModalProps) {
  const [targetDepartment, setTargetDepartment] = useState("")
  const [comments, setComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  if (!patient) return null

  const handleNurseSubmit = async () => {
    setIsSubmitting(true)

    try {
      // Create transfer request with all required fields
      await MLPredictionService.createTransferRequest({
        patient_id: patient.id,
        nurse_id: localStorage.getItem("username") || "Nurse",
        doctor_id: undefined,
        department_admin_id: undefined,
        status: "pending",
        target_department: undefined,
        notes: comments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      setIsSubmitting(false)
      setShowConfirmation(false)
      onClose()

      // Reset form
      setComments("")
    } catch (err) {
      console.error("Failed to create transfer request:", err)
      setIsSubmitting(false)
    }
  }

  const handleDoctorApproval = async () => {
    if (!targetDepartment) return

    setIsSubmitting(true)

    try {
      // Find existing pending request for this patient
      const requests = await MLPredictionService.getTransferRequests()
      const pendingRequest = requests.find(r => r.patient_id === patient.id && r.status === "pending")
      
      if (pendingRequest) {
        // Update the existing request
        await MLPredictionService.updateTransferRequest(pendingRequest.id!, {
          status: "doctor_approved",
          doctor_id: localStorage.getItem("username") || "Doctor",
          target_department: targetDepartment,
          updated_at: new Date().toISOString(),
          notes: comments
        })
      } else {
        // Create new request if none exists
        await MLPredictionService.createTransferRequest({
          patient_id: patient.id,
          nurse_id: "System",
          doctor_id: localStorage.getItem("username") || "Doctor",
          department_admin_id: undefined,
          status: "doctor_approved",
          target_department: targetDepartment,
          notes: comments,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      setIsSubmitting(false)
      onClose()

      // Reset form
      setTargetDepartment("")
      setComments("")
    } catch (err) {
      console.error("Failed to approve transfer:", err)
      setIsSubmitting(false)
    }
  }

  const getDepartmentOptions = () => {
    const allDepts = ["General Ward", "ED", "Cardiac Unit", "Surgical Ward", "Step-Down Unit"]
    return allDepts
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl text-blue-600">
            <ArrowRightLeft className="h-6 w-6" />
            {userRole === "Doctor" ? "Transfer Review & Approval" : "Transfer Request"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {userRole === "Doctor"
              ? "Review patient details and decide on transfer approval and destination"
              : "Request doctor review for potential patient transfer"}
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6">
            {/* Enhanced Patient Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800">{patient.name}</h3>
                  <p className="text-gray-600">
                    {patient.id} • Age {patient.age} • ICU
                  </p>
                </div>
                <Badge className={patient.prediction?.transferReady ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                  {patient.prediction?.transferReady ? "AI: Transfer Ready" : "AI: Continue ICU"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Current Location</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-gray-500" />
                      <span>ICU Bed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Status: {patient.onVentilator ? "On Ventilator" : patient.onPressors ? "On Pressors" : "Stable"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Current Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <span>Last Update: {new Date(patient.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-gray-500" />
                      <span>AI Confidence: {Math.round((patient.prediction?.confidence || 0) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Assessment Panel */}
            <div
              className={`p-4 rounded-xl border-2 ${
                patient.prediction?.transferReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <Brain
                  className={`h-5 w-5 ${patient.prediction?.transferReady ? "text-green-600" : "text-amber-600"}`}
                />
                <h4
                  className={`font-semibold ${
                    patient.prediction?.transferReady ? "text-green-800" : "text-amber-800"
                  }`}
                >
                  ML Model Assessment
                </h4>
              </div>
              <p className={`text-sm mb-3 ${patient.prediction?.transferReady ? "text-green-700" : "text-amber-700"}`}>
                {patient.prediction?.reasoning || "Assessment unavailable"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(patient.prediction?.riskFactors || []).map((factor: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Current Vitals Display */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="font-semibold text-gray-700 mb-3">Current Vitals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.heartRate)}</div>
                  <div className="text-gray-600">HR (bpm)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.spO2)}</div>
                  <div className="text-gray-600">SpO₂ (%)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.respiratoryRate)}</div>
                  <div className="text-gray-600">Resp (/min)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">
                    {Math.round(patient.vitals.systolicBP)}
                  </div>
                  <div className="text-gray-600">Systolic BP (mmHg)</div>
                </div>
              </div>
            </div>

            {/* Doctor-only Department Selection */}
            {userRole === "Doctor" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold text-blue-600">Transfer To Department:</Label>
                <Select value={targetDepartment} onValueChange={setTargetDepartment}>
                  <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:border-blue-500">
                    <SelectValue placeholder="Select target department" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDepartmentOptions().map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        <div className="flex items-center gap-3 py-1">
                          <Bed className="h-4 w-4" />
                          <span>{dept}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comments Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-blue-600">
                {userRole === "Doctor" ? "Clinical Notes:" : "Nursing Notes:"}
              </Label>
              <Textarea
                placeholder={
                  userRole === "Doctor"
                    ? "Enter clinical reasoning for transfer decision..."
                    : "Add any relevant nursing observations or concerns..."
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="min-h-24 border-2 border-gray-200 focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base bg-transparent">
                Cancel
              </Button>

              {userRole === "Nurse" ? (
                <Button onClick={() => setShowConfirmation(true)} className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white">
                  <Send className="h-5 w-5 mr-2" />
                  Send to Doctor for Review
                </Button>
              ) : (
                <Button
                  onClick={handleDoctorApproval}
                  disabled={!targetDepartment || isSubmitting}
                  className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Approve Transfer
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Nurse Confirmation Dialog */}
            <div className="text-center">
              <Hourglass className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Transfer Request</h3>
              <p className="text-gray-600 mb-6">Send this patient for doctor review and transfer consideration?</p>

              <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto">
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Patient:</strong> {patient.name}
                  </p>
                  <p>
                    <strong>Current Location:</strong> ICU
                  </p>
                  <p>
                    <strong>Requested by:</strong> {localStorage.getItem("username")} (Nurse)
                  </p>
                  <p>
                    <strong>AI Assessment:</strong>{" "}
                    {patient.prediction?.transferReady ? "Transfer Ready" : "Continue ICU Care"}
                  </p>
                  {comments && (
                    <p>
                      <strong>Notes:</strong> {comments}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                className="flex-1 h-12 text-base"
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                onClick={handleNurseSubmit}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </div>
                ) : (
                  <>
                    <Stethoscope className="h-5 w-5 mr-2" />
                    Confirm & Send to Doctor
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
