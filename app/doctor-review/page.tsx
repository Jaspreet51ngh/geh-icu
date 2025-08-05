"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Stethoscope,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Activity,
} from "lucide-react"
import { MLPredictionService, type TransferRequest, type Patient } from "@/lib/ml-service"
import { useRouter } from "next/navigation"

export default function DoctorReview() {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Get user info
    const user = localStorage.getItem("username") || "Doctor"
    const role = localStorage.getItem("userRole")
    setUsername(user)

    if (role !== "doctor") {
      router.push("/")
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Connect to WebSocket for real-time updates
        MLPredictionService.connectWebSocket()
        
        // Add listeners for real-time updates
        MLPredictionService.addListener('transfer_request_created', handleTransferRequestCreated)
        MLPredictionService.addListener('transfer_request_updated', handleTransferRequestUpdated)
        
        // Fetch initial data
        await fetchTransferRequests()
        await fetchPatients()
        
        setError(null)
      } catch (err) {
        setError("Failed to connect to backend. Please check if the server is running.")
        console.error("Initialization error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Cleanup listeners on unmount
    return () => {
      MLPredictionService.removeListener('transfer_request_created', handleTransferRequestCreated)
      MLPredictionService.removeListener('transfer_request_updated', handleTransferRequestUpdated)
    }
  }, [router])

  const fetchTransferRequests = async () => {
    try {
      const requests = await MLPredictionService.getTransferRequests()
      setTransferRequests(requests)
    } catch (err) {
      console.error("Failed to fetch transfer requests:", err)
    }
  }

  const fetchPatients = async () => {
    try {
      const patientData = await MLPredictionService.getAllPatients()
      setPatients(patientData)
    } catch (err) {
      console.error("Failed to fetch patients:", err)
    }
  }

  const handleTransferRequestCreated = (data: TransferRequest) => {
    setTransferRequests(prev => [...prev, data])
  }

  const handleTransferRequestUpdated = (data: TransferRequest) => {
    setTransferRequests(prev => 
      prev.map(req => req.id === data.id ? data : req)
    )
  }

  const handleApprove = async (requestId: string) => {
    try {
      await MLPredictionService.updateTransferRequest(requestId, {
        status: "doctor_approved",
        doctor_id: username,
        updated_at: new Date().toISOString()
      })
      
      // Refresh data
      await fetchTransferRequests()
    } catch (err) {
      console.error("Failed to approve request:", err)
      setError("Failed to approve transfer request")
    }
  }

  const handleReject = async (requestId: string, notes?: string) => {
    try {
      await MLPredictionService.updateTransferRequest(requestId, {
        status: "rejected",
        doctor_id: username,
        notes: notes || "Rejected by doctor",
        updated_at: new Date().toISOString()
      })
      
      // Refresh data
      await fetchTransferRequests()
    } catch (err) {
      console.error("Failed to reject request:", err)
      setError("Failed to reject transfer request")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("username")
    localStorage.removeItem("userRole")
    router.push("/")
  }

  const handleRefresh = () => {
    fetchTransferRequests()
    fetchPatients()
  }

  const pendingRequests = transferRequests.filter(r => r.status === "pending")
  const approvedRequests = transferRequests.filter(r => r.status === "doctor_approved")
  const rejectedRequests = transferRequests.filter(r => r.status === "rejected")

  const getPatientById = (patientId: string) => {
    return patients.find(p => p.id === patientId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading doctor review interface...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Stethoscope className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Doctor Review</h1>
              </div>
              <div className="text-sm text-gray-500">
                Welcome, Dr. {username}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting your review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Transfer approved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Transfer rejected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{transferRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Pending Transfer Requests</h2>
          
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
                <p className="text-gray-500">All transfer requests have been reviewed.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingRequests.map((request) => {
                const patient = getPatientById(request.patient_id)
                
                return (
                  <Card key={request.id} className="border-orange-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Transfer Request {request.id}
                        </CardTitle>
                        <Badge className="bg-orange-100 text-orange-800">
                          Pending Review
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        Requested by: {request.nurse_id} • {new Date(request.created_at).toLocaleString()}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {patient ? (
                        <>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-blue-900 mb-2">Patient Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Name:</span> {patient.name}
                              </div>
                              <div>
                                <span className="font-medium">Age:</span> {patient.age} years
                              </div>
                              <div>
                                <span className="font-medium">Heart Rate:</span> {patient.vitals.heartRate} bpm
                              </div>
                              <div>
                                <span className="font-medium">SpO2:</span> {patient.vitals.spO2}%
                              </div>
                              <div>
                                <span className="font-medium">GCS:</span> {patient.vitals.gcs}/15
                              </div>
                              <div>
                                <span className="font-medium">Lactate:</span> {patient.vitals.lactate} mmol/L
                              </div>
                            </div>
                          </div>

                          {patient.prediction && (
                            <div className="bg-green-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-green-900 mb-2">ML Prediction</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Transfer Ready:</span>
                                  <Badge variant={patient.prediction.transferReady ? "default" : "secondary"}>
                                    {patient.prediction.transferReady ? "Yes" : "No"}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span>Confidence:</span>
                                  <span className="font-medium">{(patient.prediction.confidence * 100).toFixed(1)}%</span>
                                </div>
                                <div>
                                  <span className="font-medium">Reasoning:</span>
                                  <p className="text-gray-700 mt-1">{patient.prediction.reasoning}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          Patient data not available
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleApprove(request.id!)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Transfer
                        </Button>
                        <Button
                          onClick={() => handleReject(request.id!)}
                          variant="outline"
                          className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {(approvedRequests.length > 0 || rejectedRequests.length > 0) && (
          <div className="mt-12 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
            
            <div className="space-y-4">
              {[...approvedRequests, ...rejectedRequests]
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 5)
                .map((request) => {
                  const patient = getPatientById(request.patient_id)
                  
                  return (
                    <Card key={request.id} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {request.status === "doctor_approved" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">
                                {request.status === "doctor_approved" ? "Approved" : "Rejected"}: {patient?.name || request.patient_id}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(request.updated_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <Badge 
                            className={
                              request.status === "doctor_approved" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {request.status === "doctor_approved" ? "Approved" : "Rejected"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
