// "use client"

// import { useState } from "react"
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Textarea } from "@/components/ui/textarea"
// import { Badge } from "@/components/ui/badge"
// import {
//   ArrowRightLeft,
//   User,
//   Bed,
//   AlertTriangle,
//   Brain,
//   Lock,
//   CheckCircle2,
//   Clock,
//   Stethoscope,
//   Activity,
//   Send,
//   Hourglass,
// } from "lucide-react"
// import { MLPredictionService } from "@/lib/ml-service"

// interface TransferRequestModalProps {
//   patient: any
//   isOpen: boolean
//   onClose: () => void
//   userRole: string
//   onRequestCreated?: () => void  // Add callback for when request is created
// }

// export function TransferRequestModal({ patient, isOpen, onClose, userRole, onRequestCreated }: TransferRequestModalProps) {
//   const [targetDepartment, setTargetDepartment] = useState("")
//   const [comments, setComments] = useState("")
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [showConfirmation, setShowConfirmation] = useState(false)

//   if (!patient) return null

//   const handleNurseSubmit = async () => {
//     setIsSubmitting(true)
  
//     try {
//       const payload = {
//         patient_id: patient.id,
//         nurse_id: localStorage.getItem("username") || "Nurse",
//         doctor_id: patient.doctor_id || null,
//         department_admin_id: patient.department_admin_id || null,
//         target_department: patient.target_department || null,
//         status: "pending",
//         notes: comments,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         ml_prediction: {
//           transferReady: patient.prediction?.transferReady || false,
//           confidence: patient.prediction?.confidence || 0,
//           reasoning: patient.prediction?.reasoning || "No prediction available",
//           riskFactors: patient.prediction?.riskFactors || [],
//           timestamp: patient.prediction?.timestamp || new Date().toISOString()
//         }
//       }
  
//       await MLPredictionService.createTransferRequest(payload)
  
//       setIsSubmitting(false)
//       setShowConfirmation(false)
//       onClose()
//       setComments("")
      
//       // ✅ FIXED: Call the callback to refresh the parent component's data
//       if (onRequestCreated) {
//         onRequestCreated()
//       }
//     } catch (err) {
//       console.error("Failed to create transfer request:", err)
//       setIsSubmitting(false)
//     }
//   }
  
//   const handleDoctorApproval = async () => {
//     if (!targetDepartment) return

//     setIsSubmitting(true)

//     try {
//       // Find existing pending request for this patient
//       const requests = await MLPredictionService.getTransferRequests()
//       const pendingRequest = requests.find(r => r.patient_id === patient.id && r.status === "pending")
      
//       if (pendingRequest) {
//         // Update the existing request
//         await MLPredictionService.updateTransferRequest(pendingRequest.id!, {
//           status: "doctor_approved",
//           doctor_id: localStorage.getItem("username") || "Doctor",
//           target_department: targetDepartment,
//           updated_at: new Date().toISOString(),
//           notes: comments
//         })
//       } else {
//         await MLPredictionService.createTransferRequest({
//           patient_id: patient.id,
//           nurse_id: localStorage.getItem("username") || "Nurse",
//           doctor_id: localStorage.getItem("username") || "Doctor",
//           department_admin_id: undefined,
//           status: "doctor_approved",
//           target_department: targetDepartment,
//           notes: comments,
//           created_at: new Date().toISOString(),
//           updated_at: new Date().toISOString(),
//           ml_prediction: {
//             transferReady: patient.prediction?.transferReady || false,
//             confidence: patient.prediction?.confidence || 0,
//             reasoning: patient.prediction?.reasoning || "No prediction available",
//             riskFactors: patient.prediction?.riskFactors || [],
//             timestamp: patient.prediction?.timestamp || new Date().toISOString()
//           }
//         })        
//       }

//       setIsSubmitting(false)
//       onClose()

//       // Reset form
//       setTargetDepartment("")
//       setComments("")
      
//       // ✅ FIXED: Call the callback to refresh the parent component's data
//       if (onRequestCreated) {
//         onRequestCreated()
//       }
//     } catch (err) {
//       console.error("Failed to approve transfer:", err)
//       setIsSubmitting(false)
//     }
//   }

//   const getDepartmentOptions = () => {
//     const allDepts = ["General Ward", "ED", "Cardiac Unit", "Surgical Ward", "Step-Down Unit"]
//     return allDepts
//   }

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-3 text-2xl text-blue-600">
//             <ArrowRightLeft className="h-6 w-6" />
//             {userRole === "Doctor" ? "Transfer Review & Approval" : "Transfer Request"}
//           </DialogTitle>
//           <DialogDescription className="text-base">
//             {userRole === "Doctor"
//               ? "Review patient details and decide on transfer approval and destination"
//               : "Request doctor review for potential patient transfer"}
//           </DialogDescription>
//         </DialogHeader>

//         {!showConfirmation ? (
//           <div className="space-y-6">
//             {/* Enhanced Patient Info */}
//             <div className="bg-white border border-gray-200 rounded-lg p-6">
//               <div className="flex items-center gap-4 mb-4">
//                 <div className="p-3 bg-blue-100 rounded-xl">
//                   <User className="h-6 w-6 text-blue-600" />
//                 </div>
//                 <div className="flex-1">
//                   <h3 className="text-xl font-bold text-gray-800">{patient.name}</h3>
//                   <p className="text-gray-600">
//                     {patient.id} • Age {patient.age} • ICU
//                   </p>
//                 </div>
//                 <Badge className={patient.prediction?.transferReady ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
//                   {patient.prediction?.transferReady ? "AI: Transfer Ready" : "AI: Continue ICU"}
//                 </Badge>
//               </div>

//               <div className="grid grid-cols-2 gap-6">
//                 <div>
//                   <h4 className="font-semibold text-gray-700 mb-3">Current Location</h4>
//                   <div className="space-y-2 text-sm">
//                     <div className="flex items-center gap-2">
//                       <Bed className="h-4 w-4 text-gray-500" />
//                       <span>ICU Bed</span>
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <Clock className="h-4 w-4 text-gray-500" />
//                       <span>Status: {patient.onVentilator ? "On Ventilator" : patient.onPressors ? "On Pressors" : "Stable"}</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div>
//                   <h4 className="font-semibold text-gray-700 mb-3">Current Status</h4>
//                   <div className="space-y-2 text-sm">
//                     <div className="flex items-center gap-2">
//                       <Activity className="h-4 w-4 text-gray-500" />
//                       <span>Last Update: {new Date(patient.lastUpdated).toLocaleTimeString()}</span>
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <Brain className="h-4 w-4 text-gray-500" />
//                       <span>AI Confidence: {Math.round((patient.prediction?.confidence || 0) )}%</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* AI Assessment Panel */}
//             <div
//               className={`p-4 rounded-xl border-2 ${
//                 patient.prediction?.transferReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
//               }`}
//             >
//               <div className="flex items-center gap-3 mb-3">
//                 <Brain
//                   className={`h-5 w-5 ${patient.prediction?.transferReady ? "text-green-600" : "text-amber-600"}`}
//                 />
//                 <h4
//                   className={`font-semibold ${
//                     patient.prediction?.transferReady ? "text-green-800" : "text-amber-800"
//                   }`}
//                 >
//                   ML Model Assessment
//                 </h4>
//               </div>
//               <p className={`text-sm mb-3 ${patient.prediction?.transferReady ? "text-green-700" : "text-amber-700"}`}>
//                 {patient.prediction?.reasoning || "Assessment unavailable"}
//               </p>
//               <div className="flex flex-wrap gap-2">
//                 {(patient.prediction?.riskFactors || []).map((factor: string, idx: number) => (
//                   <Badge key={idx} variant="outline" className="text-xs">
//                     {factor}
//                   </Badge>
//                 ))}
//               </div>
//             </div>

//             {/* Current Vitals Display */}
//             <div className="bg-gray-50 p-4 rounded-xl">
//               <h4 className="font-semibold text-gray-700 mb-3">Current Vitals</h4>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.heartRate.toFixed(1)}</div>
//                   <div className="text-gray-600">HR (bpm)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.spO2.toFixed(1)}</div>
//                   <div className="text-gray-600">SpO₂ (%)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.respiratoryRate.toFixed(1)}</div>
//                   <div className="text-gray-600">Resp (/min)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">
//                     {patient.vitals.systolicBP.toFixed(1)}
//                   </div>
//                   <div className="text-gray-600">Systolic BP (mmHg)</div>
//                 </div>
//               </div>
//             </div>

//             {/* Doctor-only Department Selection */}
//             {userRole === "Doctor" && (
//               <div className="space-y-3">
//                 <Label className="text-base font-semibold text-blue-600">Transfer To Department:</Label>
//                 <Select value={targetDepartment} onValueChange={setTargetDepartment}>
//                   <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:border-blue-500">
//                     <SelectValue placeholder="Select target department" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {getDepartmentOptions().map((dept) => (
//                       <SelectItem key={dept} value={dept}>
//                         <div className="flex items-center gap-3 py-1">
//                           <Bed className="h-4 w-4" />
//                           <span>{dept}</span>
//                         </div>
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>
//             )}

//             {/* Comments Section */}
//             <div className="space-y-3">
//               <Label className="text-base font-semibold text-blue-600">
//                 {userRole === "Doctor" ? "Clinical Notes:" : "Nursing Notes:"}
//               </Label>
//               <Textarea
//                 placeholder={
//                   userRole === "Doctor"
//                     ? "Enter clinical reasoning for transfer decision..."
//                     : "Add any relevant nursing observations or concerns..."
//                 }
//                 value={comments}
//                 onChange={(e) => setComments(e.target.value)}
//                 className="min-h-24 border-2 border-gray-200 focus:border-blue-500"
//               />
//             </div>

//             {/* Action Buttons */}
//             <div className="flex gap-4 pt-4">
//               <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base bg-transparent">
//                 Cancel
//               </Button>

//               {userRole === "Nurse" ? (
//                 <Button onClick={() => setShowConfirmation(true)} className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white">
//                   <Send className="h-5 w-5 mr-2" />
//                   Send to Doctor for Review
//                 </Button>
//               ) : (
//                 <Button
//                   onClick={handleDoctorApproval}
//                   disabled={!targetDepartment || isSubmitting}
//                   className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
//                 >
//                   {isSubmitting ? (
//                     <div className="flex items-center gap-2">
//                       <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//                       Processing...
//                     </div>
//                   ) : (
//                     <>
//                       <CheckCircle2 className="h-5 w-5 mr-2" />
//                       Approve Transfer
//                     </>
//                   )}
//                 </Button>
//               )}
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-6 py-4">
//             {/* Nurse Confirmation Dialog */}
//             <div className="text-center">
//               <Hourglass className="h-16 w-16 text-blue-500 mx-auto mb-4" />
//               <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Transfer Request</h3>
//               <p className="text-gray-600 mb-6">Send this patient for doctor review and transfer consideration?</p>

//               <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto">
//                 <div className="text-sm space-y-1">
//                   <p>
//                     <strong>Patient:</strong> {patient.name}
//                   </p>
//                   <p>
//                     <strong>Current Location:</strong> ICU
//                   </p>
//                   <p>
//                     <strong>Requested by:</strong> {localStorage.getItem("username")} (Nurse)
//                   </p>
//                   <p>
//                     <strong>AI Assessment:</strong>{" "}
//                     {patient.prediction?.transferReady ? "Transfer Ready" : "Continue ICU Care"}
//                   </p>
//                   {comments && (
//                     <p>
//                       <strong>Notes:</strong> {comments}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>

//             <div className="flex gap-4">
//               <Button
//                 variant="outline"
//                 onClick={() => setShowConfirmation(false)}
//                 className="flex-1 h-12 text-base"
//                 disabled={isSubmitting}
//               >
//                 Back
//               </Button>
//               <Button
//                 onClick={handleNurseSubmit}
//                 disabled={isSubmitting}
//                 className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
//               >
//                 {isSubmitting ? (
//                   <div className="flex items-center gap-2">
//                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//                     Sending...
//                   </div>
//                 ) : (
//                   <>
//                     <Stethoscope className="h-5 w-5 mr-2" />
//                     Confirm & Send to Doctor
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//         )}
//       </DialogContent>
//     </Dialog>
//   )
// }
// "use client"

// import { useState } from "react"
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Textarea } from "@/components/ui/textarea"
// import { Badge } from "@/components/ui/badge"
// import {
//   ArrowRightLeft,
//   User,
//   Bed,
//   AlertTriangle,
//   Brain,
//   Lock,
//   CheckCircle2,
//   Clock,
//   Stethoscope,
//   Activity,
//   Send,
//   Hourglass,
// } from "lucide-react"
// import { MLPredictionService } from "@/lib/ml-service"

// interface TransferRequestModalProps {
//   patient: any
//   isOpen: boolean
//   onClose: () => void
//   userRole: string
//   onRequestCreated?: () => void
// }

// export function TransferRequestModal({ patient, isOpen, onClose, userRole, onRequestCreated }: TransferRequestModalProps) {
//   const [targetDepartment, setTargetDepartment] = useState("")
//   const [comments, setComments] = useState("")
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [showConfirmation, setShowConfirmation] = useState(false)

//   if (!patient) return null

//   const handleNurseSubmit = async () => {
//     setIsSubmitting(true)
  
//     try {
//       console.log("Creating nurse transfer request for patient:", patient.id)
      
//       const payload = {
//         patient_id: patient.id,
//         nurse_id: localStorage.getItem("username") || "admin",
//         doctor_id: null,
//         department_admin_id: null,
//         target_department: null,
//         status: "pending",
//         notes: comments.trim(),
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         ml_prediction: {
//           transferReady: patient.prediction?.transferReady || false,
//           confidence: patient.prediction?.confidence || 0,
//           reasoning: patient.prediction?.reasoning || "No prediction available",
//           riskFactors: patient.prediction?.riskFactors || [],
//           timestamp: patient.prediction?.timestamp || new Date().toISOString()
//         }
//       }

//       console.log("Sending payload:", payload)
      
//       const response = await fetch("http://localhost:8000/transfer-request", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       })

//       if (!response.ok) {
//         const errorText = await response.text()
//         throw new Error(`HTTP ${response.status}: ${errorText}`)
//       }

//       const result = await response.json()
//       console.log("Transfer request created successfully:", result)

//       setIsSubmitting(false)
//       setShowConfirmation(false)
//       onClose()
//       setComments("")
//       setTargetDepartment("")
      
//       // Trigger refresh in parent component
//       if (onRequestCreated) {
//         console.log("Calling onRequestCreated callback")
//         onRequestCreated()
//       }

//       // Show success message
//       alert("Transfer request sent to doctor for review successfully!")
      
//     } catch (err) {
//       console.error("Failed to create transfer request:", err)
//       setIsSubmitting(false)
//       alert(`Failed to create transfer request: ${err.message}`)
//     }
//   }
  
//   const handleDoctorApproval = async () => {
//     if (!targetDepartment) {
//       alert("Please select a target department")
//       return
//     }

//     setIsSubmitting(true)

//     try {
//       console.log("Doctor approving transfer for patient:", patient.id)
      
//       // First, get all transfer requests to find if there's a pending one
//       const requestsResponse = await fetch("http://localhost:8000/transfer-requests")
//       const requests = await requestsResponse.json()
      
//       const pendingRequest = requests.find(r => 
//         r.patient_id === patient.id && r.status === "pending"
//       )
      
//       if (pendingRequest) {
//         console.log("Updating existing pending request:", pendingRequest.id)
        
//         // Update the existing request
//         const updateResponse = await fetch(`http://localhost:8000/transfer-request/${pendingRequest.id}`, {
//           method: "PUT",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             status: "doctor_approved",
//             doctor_id: localStorage.getItem("username") || "doctor",
//             target_department: targetDepartment,
//             notes: comments.trim(),
//             updated_at: new Date().toISOString()
//           })
//         })

//         if (!updateResponse.ok) {
//           const errorText = await updateResponse.text()
//           throw new Error(`HTTP ${updateResponse.status}: ${errorText}`)
//         }

//         const result = await updateResponse.json()
//         console.log("Transfer request updated successfully:", result)
        
//       } else {
//         console.log("Creating new doctor-approved transfer request")
        
//         // Create a new doctor-approved request
//         const payload = {
//           patient_id: patient.id,
//           nurse_id: localStorage.getItem("username") || "nurse",
//           doctor_id: localStorage.getItem("username") || "doctor",
//           department_admin_id: null,
//           status: "doctor_approved",
//           target_department: targetDepartment,
//           notes: comments.trim(),
//           created_at: new Date().toISOString(),
//           updated_at: new Date().toISOString(),
//           ml_prediction: {
//             transferReady: patient.prediction?.transferReady || false,
//             confidence: patient.prediction?.confidence || 0,
//             reasoning: patient.prediction?.reasoning || "No prediction available",
//             riskFactors: patient.prediction?.riskFactors || [],
//             timestamp: patient.prediction?.timestamp || new Date().toISOString()
//           }
//         }

//         const createResponse = await fetch("http://localhost:8000/transfer-request", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(payload),
//         })

//         if (!createResponse.ok) {
//           const errorText = await createResponse.text()
//           throw new Error(`HTTP ${createResponse.status}: ${errorText}`)
//         }

//         const result = await createResponse.json()
//         console.log("New transfer request created successfully:", result)
//       }

//       setIsSubmitting(false)
//       onClose()

//       // Reset form
//       setTargetDepartment("")
//       setComments("")
      
//       // Trigger refresh in parent component
//       if (onRequestCreated) {
//         console.log("Calling onRequestCreated callback")
//         onRequestCreated()
//       }

//       // Show success message
//       alert(`Transfer approved and scheduled for ${targetDepartment}!`)
      
//     } catch (err) {
//       console.error("Failed to approve transfer:", err)
//       setIsSubmitting(false)
//       alert(`Failed to approve transfer: ${err.message}`)
//     }
//   }

//   const getDepartmentOptions = () => {
//     const allDepts = ["General Ward", "ED", "Cardiac Unit", "Surgical Ward", "Step-Down Unit"]
//     return allDepts
//   }

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-3 text-2xl text-blue-600">
//             <ArrowRightLeft className="h-6 w-6" />
//             {userRole === "Doctor" ? "Transfer Review & Approval" : "Transfer Request"}
//           </DialogTitle>
//           <DialogDescription className="text-base">
//             {userRole === "Doctor"
//               ? "Review patient details and decide on transfer approval and destination"
//               : "Request doctor review for potential patient transfer"}
//           </DialogDescription>
//         </DialogHeader>

//         {!showConfirmation ? (
//           <div className="space-y-6">
//             {/* Enhanced Patient Info */}
//             <div className="bg-white border border-gray-200 rounded-lg p-6">
//               <div className="flex items-center gap-4 mb-4">
//                 <div className="p-3 bg-blue-100 rounded-xl">
//                   <User className="h-6 w-6 text-blue-600" />
//                 </div>
//                 <div className="flex-1">
//                   <h3 className="text-xl font-bold text-gray-800">{patient.name}</h3>
//                   <p className="text-gray-600">
//                     {patient.id} • Age {patient.age} • ICU
//                   </p>
//                 </div>
//                 <Badge className={patient.prediction?.transferReady ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
//                   {patient.prediction?.transferReady ? "AI: Transfer Ready" : "AI: Continue ICU"}
//                 </Badge>
//               </div>

//               <div className="grid grid-cols-2 gap-6">
//                 <div>
//                   <h4 className="font-semibold text-gray-700 mb-3">Current Location</h4>
//                   <div className="space-y-2 text-sm">
//                     <div className="flex items-center gap-2">
//                       <Bed className="h-4 w-4 text-gray-500" />
//                       <span>ICU Bed</span>
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <Clock className="h-4 w-4 text-gray-500" />
//                       <span>Status: {patient.onVentilator ? "On Ventilator" : patient.onPressors ? "On Pressors" : "Stable"}</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div>
//                   <h4 className="font-semibold text-gray-700 mb-3">Current Status</h4>
//                   <div className="space-y-2 text-sm">
//                     <div className="flex items-center gap-2">
//                       <Activity className="h-4 w-4 text-gray-500" />
//                       <span>Last Update: {new Date(patient.lastUpdated).toLocaleTimeString()}</span>
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <Brain className="h-4 w-4 text-gray-500" />
//                       <span>AI Confidence: {Math.round((patient.prediction?.confidence || 0) )}%</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* AI Assessment Panel */}
//             <div
//               className={`p-4 rounded-xl border-2 ${
//                 patient.prediction?.transferReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
//               }`}
//             >
//               <div className="flex items-center gap-3 mb-3">
//                 <Brain
//                   className={`h-5 w-5 ${patient.prediction?.transferReady ? "text-green-600" : "text-amber-600"}`}
//                 />
//                 <h4
//                   className={`font-semibold ${
//                     patient.prediction?.transferReady ? "text-green-800" : "text-amber-800"
//                   }`}
//                 >
//                   ML Model Assessment
//                 </h4>
//               </div>
//               <p className={`text-sm mb-3 ${patient.prediction?.transferReady ? "text-green-700" : "text-amber-700"}`}>
//                 {patient.prediction?.reasoning || "Assessment unavailable"}
//               </p>
//               <div className="flex flex-wrap gap-2">
//                 {(patient.prediction?.riskFactors || []).map((factor: string, idx: number) => (
//                   <Badge key={idx} variant="outline" className="text-xs">
//                     {factor}
//                   </Badge>
//                 ))}
//               </div>
//             </div>

//             {/* Current Vitals Display */}
//             <div className="bg-gray-50 p-4 rounded-xl">
//               <h4 className="font-semibold text-gray-700 mb-3">Current Vitals</h4>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.heartRate.toFixed(1)}</div>
//                   <div className="text-gray-600">HR (bpm)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.spO2.toFixed(1)}</div>
//                   <div className="text-gray-600">SpO₂ (%)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">{patient.vitals.respiratoryRate.toFixed(1)}</div>
//                   <div className="text-gray-600">Resp (/min)</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="font-bold text-lg">
//                     {patient.vitals.systolicBP.toFixed(1)}
//                   </div>
//                   <div className="text-gray-600">Systolic BP (mmHg)</div>
//                 </div>
//               </div>
//             </div>

//             {/* Doctor-only Department Selection */}
//             {userRole === "Doctor" && (
//               <div className="space-y-3">
//                 <Label className="text-base font-semibold text-blue-600">Transfer To Department:</Label>
//                 <Select value={targetDepartment} onValueChange={setTargetDepartment}>
//                   <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:border-blue-500">
//                     <SelectValue placeholder="Select target department" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {getDepartmentOptions().map((dept) => (
//                       <SelectItem key={dept} value={dept}>
//                         <div className="flex items-center gap-3 py-1">
//                           <Bed className="h-4 w-4" />
//                           <span>{dept}</span>
//                         </div>
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>
//             )}

//             {/* Comments Section */}
//             <div className="space-y-3">
//               <Label className="text-base font-semibold text-blue-600">
//                 {userRole === "Doctor" ? "Clinical Notes:" : "Nursing Notes:"}
//               </Label>
//               <Textarea
//                 placeholder={
//                   userRole === "Doctor"
//                     ? "Enter clinical reasoning for transfer decision..."
//                     : "Add any relevant nursing observations or concerns..."
//                 }
//                 value={comments}
//                 onChange={(e) => setComments(e.target.value)}
//                 className="min-h-24 border-2 border-gray-200 focus:border-blue-500"
//               />
//             </div>

//             {/* Action Buttons */}
//             <div className="flex gap-4 pt-4">
//               <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base bg-transparent">
//                 Cancel
//               </Button>

//               {userRole === "Nurse" ? (
//                 <Button onClick={() => setShowConfirmation(true)} className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white">
//                   <Send className="h-5 w-5 mr-2" />
//                   Send to Doctor for Review
//                 </Button>
//               ) : (
//                 <Button
//                   onClick={handleDoctorApproval}
//                   disabled={!targetDepartment || isSubmitting}
//                   className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
//                 >
//                   {isSubmitting ? (
//                     <div className="flex items-center gap-2">
//                       <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//                       Processing...
//                     </div>
//                   ) : (
//                     <>
//                       <CheckCircle2 className="h-5 w-5 mr-2" />
//                       Approve Transfer
//                     </>
//                   )}
//                 </Button>
//               )}
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-6 py-4">
//             {/* Nurse Confirmation Dialog */}
//             <div className="text-center">
//               <Hourglass className="h-16 w-16 text-blue-500 mx-auto mb-4" />
//               <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Transfer Request</h3>
//               <p className="text-gray-600 mb-6">Send this patient for doctor review and transfer consideration?</p>

//               <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto">
//                 <div className="text-sm space-y-1">
//                   <p>
//                     <strong>Patient:</strong> {patient.name}
//                   </p>
//                   <p>
//                     <strong>Current Location:</strong> ICU
//                   </p>
//                   <p>
//                     <strong>Requested by:</strong> {localStorage.getItem("username")} (Nurse)
//                   </p>
//                   <p>
//                     <strong>AI Assessment:</strong>{" "}
//                     {patient.prediction?.transferReady ? "Transfer Ready" : "Continue ICU Care"}
//                   </p>
//                   {comments && (
//                     <p>
//                       <strong>Notes:</strong> {comments}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>

//             <div className="flex gap-4">
//               <Button
//                 variant="outline"
//                 onClick={() => setShowConfirmation(false)}
//                 className="flex-1 h-12 text-base"
//                 disabled={isSubmitting}
//               >
//                 Back
//               </Button>
//               <Button
//                 onClick={handleNurseSubmit}
//                 disabled={isSubmitting}
//                 className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
//               >
//                 {isSubmitting ? (
//                   <div className="flex items-center gap-2">
//                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//                     Sending...
//                   </div>
//                 ) : (
//                   <>
//                     <Stethoscope className="h-5 w-5 mr-2" />
//                     Confirm & Send to Doctor
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//         )}
//       </DialogContent>
//     </Dialog>
//   )
// }
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
  XCircle,
} from "lucide-react"
import { MLPredictionService } from "@/lib/ml-service"
import { toast } from "@/components/ui/use-toast"

interface TransferRequestModalProps {
  patient: any
  isOpen: boolean
  onClose: () => void
  userRole: string
  onRequestCreated?: () => void
  pendingRequest?: any
}

export function TransferRequestModal({ patient, isOpen, onClose, userRole, onRequestCreated, pendingRequest }: TransferRequestModalProps) {
  const [targetDepartment, setTargetDepartment] = useState("")
  const [comments, setComments] = useState(pendingRequest?.notes || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  if (!patient) return null

  const handleNurseSubmit = async () => {
    setIsSubmitting(true)
    try {
      console.log("Creating nurse transfer request for patient:", patient.id)
      
      const payload = {
        patient_id: patient.id,
        nurse_id: localStorage.getItem("username") || "nurse",
        doctor_id: null,
        department_admin_id: null,
        target_department: null,
        status: "pending",
        notes: comments.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ml_prediction: {
          transferReady: patient.prediction?.transferReady || false,
          confidence: patient.prediction?.confidence || 0,
          reasoning: patient.prediction?.reasoning || "No prediction available",
          riskFactors: patient.prediction?.riskFactors || [],
          timestamp: patient.prediction?.timestamp || new Date().toISOString()
        }
      }

      await MLPredictionService.createTransferRequest(payload)
  
      setIsSubmitting(false)
      setShowConfirmation(false)
      onClose()
      setComments("")
      setTargetDepartment("")
      
      if (onRequestCreated) {
        onRequestCreated()
      }

      toast({
        title: "✅ Request Sent",
        description: "Your transfer request has been sent to the doctor for review.",
      })
      
    } catch (err) {
      console.error("Failed to create transfer request:", err)
      setIsSubmitting(false)
      toast({
        title: "❌ Error",
        description: `Failed to create transfer request. Please try again.`,
        variant: "destructive",
      })
    }
  }
  
  const handleDoctorApproval = async () => {
    if (!targetDepartment) {
      toast({
        title: "❗ Missing Department",
        description: "Please select a target department before approving.",
        variant: "warning",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const requestId = pendingRequest?.id
      if (!requestId) {
        throw new Error("No pending request found to approve.")
      }

      await MLPredictionService.approveTransferRequest(
        requestId,
        localStorage.getItem("username") || "doctor",
        targetDepartment,
        comments.trim()
      )

      setIsSubmitting(false)
      onClose()
      setTargetDepartment("")
      setComments("")
      
      if (onRequestCreated) {
        onRequestCreated()
      }

      toast({
        title: "✅ Transfer Approved",
        description: `Patient transfer to ${targetDepartment} has been approved.`,
      })
      
    } catch (err) {
      console.error("Failed to approve transfer:", err)
      setIsSubmitting(false)
      toast({
        title: "❌ Error",
        description: `Failed to approve transfer: ${err.message}`,
        variant: "destructive",
      })
    }
  }

  const handleDoctorRejection = async () => {
    setIsSubmitting(true)
    try {
      const requestId = pendingRequest?.id
      if (!requestId) {
        throw new Error("No pending request found to reject.")
      }

      await MLPredictionService.rejectTransferRequest(
        requestId,
        localStorage.getItem("username") || "doctor",
        comments.trim()
      )

      setIsSubmitting(false)
      onClose()
      setComments("")
      
      if (onRequestCreated) {
        onRequestCreated()
      }

      toast({
        title: "❌ Transfer Rejected",
        description: "The transfer request has been rejected.",
        variant: "destructive",
      })
      
    } catch (err) {
      console.error("Failed to reject transfer:", err)
      setIsSubmitting(false)
      toast({
        title: "❌ Error",
        description: `Failed to reject transfer: ${err.message}`,
        variant: "destructive",
      })
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

        {!showConfirmation || userRole === "Doctor" ? (
          <div className="space-y-6">
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
                      <span>AI Confidence: {Math.round((patient.prediction?.confidence || 0) )}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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

            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="font-semibold text-gray-700 mb-3">Current Vitals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-lg">{patient.vitals.heartRate.toFixed(1)}</div>
                  <div className="text-gray-600">HR (bpm)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{patient.vitals.spO2.toFixed(1)}</div>
                  <div className="text-gray-600">SpO₂ (%)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{patient.vitals.respiratoryRate.toFixed(1)}</div>
                  <div className="text-gray-600">Resp (/min)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">
                    {patient.vitals.systolicBP.toFixed(1)}
                  </div>
                  <div className="text-gray-600">Systolic BP (mmHg)</div>
                </div>
              </div>
            </div>

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
                <>
                  <Button
                    onClick={handleDoctorRejection}
                    disabled={isSubmitting}
                    className="flex-1 h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Rejecting...
                      </div>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 mr-2" />
                        Reject Transfer
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDoctorApproval}
                    disabled={!targetDepartment || isSubmitting}
                    className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Approving...
                      </div>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Approve Transfer
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
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