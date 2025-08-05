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
} from "lucide-react"

interface TransferRequestModalProps {
  patient: any
  isOpen: boolean
  onClose: () => void
  userRole: string
}

export function TransferRequestModal({ patient, isOpen, onClose, userRole }: TransferRequestModalProps) {
  const [targetDepartment, setTargetDepartment] = useState("")
  const [doctorPassword, setDoctorPassword] = useState("")
  const [comments, setComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)

  if (!patient) return null

  const handleNurseSubmit = () => {
    // Nurse just sends request to doctor - no department selection needed
    setShowConfirmation(true)
  }

  const handleDoctorApproval = () => {
    if (!targetDepartment) return
    setShowPasswordPrompt(true)
  }

  const handlePasswordSubmit = async () => {
    if (!doctorPassword) return

    setIsSubmitting(true)

    // Simulate password verification and approval
    setTimeout(() => {
      console.log(`Doctor approved transfer: ${patient.id} → ${targetDepartment}`)
      setIsSubmitting(false)
      setShowPasswordPrompt(false)
      onClose()

      // Show success notification
      alert(`Transfer approved! Notification sent to ${targetDepartment} administrator.`)

      // Reset form
      setTargetDepartment("")
      setDoctorPassword("")
      setComments("")
    }, 2000)
  }

  const handleNurseConfirm = async () => {
    setIsSubmitting(true)

    // Simulate API call to notify doctor
    setTimeout(() => {
      console.log(`Nurse transfer request: ${patient.id} sent to doctor`)
      setIsSubmitting(false)
      setShowConfirmation(false)
      onClose()

      // Show success notification
      alert(`Transfer request sent to doctor for review: ${patient.name}`)

      // Reset form
      setComments("")
    }, 1500)
  }

  const getDepartmentOptions = () => {
    const allDepts = ["General Ward", "ED", "Cardiac Unit", "Surgical Ward", "Step-Down Unit"]
    return allDepts
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl text-teal-primary">
            <ArrowRightLeft className="h-6 w-6" />
            {userRole === "Doctor" ? "Transfer Review & Approval" : "Transfer Request"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {userRole === "Doctor"
              ? "Review patient details and decide on transfer approval and destination"
              : "Request doctor review for potential patient transfer"}
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation && !showPasswordPrompt ? (
          <div className="space-y-6">
            {/* Enhanced Patient Info */}
            <div className="professional-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-teal-100 rounded-xl">
                  <User className="h-6 w-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-800">{patient.name}</h3>
                  <p className="text-slate-600">
                    {patient.id} • Age {patient.age} • ICU
                  </p>
                </div>
                <Badge className={patient.prediction?.transferReady ? "status-normal" : "status-elevated"}>
                  {patient.prediction?.transferReady ? "AI: Transfer Ready" : "AI: Continue ICU"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Current Location</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-slate-500" />
                      <span>ICU Bed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span>Status: {patient.onVentilator ? "On Ventilator" : patient.onPressors ? "On Pressors" : "Stable"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Current Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-slate-500" />
                      <span>Last Update: {new Date(patient.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-slate-500" />
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
            <div className="bg-slate-50 p-4 rounded-xl">
              <h4 className="font-semibold text-slate-700 mb-3">Current Vitals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.heartRate)}</div>
                  <div className="text-slate-600">HR (bpm)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.spO2)}</div>
                  <div className="text-slate-600">SpO₂ (%)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(patient.vitals.respiratoryRate)}</div>
                  <div className="text-slate-600">Resp (/min)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">
                    {Math.round(patient.vitals.systolicBP)}
                  </div>
                  <div className="text-slate-600">Systolic BP (mmHg)</div>
                </div>
              </div>
            </div>

            {/* Doctor-only Department Selection */}
            {userRole === "Doctor" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold text-teal-primary">Transfer To Department:</Label>
                <Select value={targetDepartment} onValueChange={setTargetDepartment}>
                  <SelectTrigger className="h-12 text-base border-2 border-slate-200 focus:border-teal-500">
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
              <Label className="text-base font-semibold text-teal-primary">
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
                className="min-h-24 border-2 border-slate-200 focus:border-teal-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base bg-transparent">
                Cancel
              </Button>

              {userRole === "Nurse" ? (
                <Button onClick={handleNurseSubmit} className="flex-1 h-12 text-base btn-teal-primary">
                  <Send className="h-5 w-5 mr-2" />
                  Send to Doctor for Review
                </Button>
              ) : (
                <Button
                  onClick={handleDoctorApproval}
                  disabled={!targetDepartment}
                  className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Approve Transfer
                </Button>
              )}
            </div>
          </div>
        ) : showPasswordPrompt ? (
          <div className="space-y-6 py-4">
            {/* Doctor Password Confirmation */}
            <div className="text-center">
              <div className="p-4 bg-blue-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Lock className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Secure Authorization Required</h3>
              <p className="text-slate-600 mb-6">Enter your doctor password to approve this transfer request</p>

              <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto mb-6">
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Patient:</strong> {patient.name}
                  </p>
                  <p>
                    <strong>From:</strong> {patient.department || 'ICU'}
                  </p>
                  <p>
                    <strong>To:</strong> {targetDepartment}
                  </p>
                  <p>
                    <strong>AI Recommendation:</strong>{" "}
                    {patient.prediction?.transferReady ? "Approved" : "Not Recommended"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold text-teal-primary">Doctor Password:</Label>
                <Input
                  type="password"
                  placeholder="Enter your secure password"
                  value={doctorPassword}
                  onChange={(e) => setDoctorPassword(e.target.value)}
                  className="h-12 text-base border-2 border-slate-200 focus:border-teal-500"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordPrompt(false)}
                  className="flex-1 h-12 text-base"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  onClick={handlePasswordSubmit}
                  disabled={!doctorPassword || isSubmitting}
                  className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Authorizing...
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Authorize Transfer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Nurse Confirmation Dialog */}
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Transfer Request</h3>
              <p className="text-slate-600 mb-6">Send this patient for doctor review and transfer consideration?</p>

              <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto">
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Patient:</strong> {patient.name}
                  </p>
                  <p>
                    <strong>Current Location:</strong> {patient.department || 'ICU'} - {patient.bed || patient.id}
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
                onClick={handleNurseConfirm}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base btn-teal-primary"
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
