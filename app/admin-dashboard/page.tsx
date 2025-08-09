"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Clock, Bed, ArrowRightLeft, Shield, LogOut, Users, AlertTriangle, RefreshCw, Activity } from "lucide-react"
import { useRouter } from "next/navigation"
import { MLPredictionService, type TransferRequest } from "@/lib/ml-service"
import ViewTransferredButton from "@/components/view-transferred-button"

// Mock bed availability data
const mockBedAvailability = {
  "General Ward": { total: 20, available: 3, occupied: 15, cleaning: 2 },
  "ICU": { total: 12, available: 1, occupied: 10, cleaning: 1 },
  "ED": { total: 8, available: 2, occupied: 5, cleaning: 1 },
  "Cardiac Unit": { total: 6, available: 0, occupied: 6, cleaning: 0 },
  "Surgical Ward": { total: 15, available: 4, occupied: 10, cleaning: 1 },
}

export default function AdminDashboardPage() {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [bedAvailability, setBedAvailability] = useState(mockBedAvailability)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState("")
  const [username, setUsername] = useState("")
  const [notifications, setNotifications] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()

  useEffect(() => {
    const role = localStorage.getItem("userRole") || ""
    const user = localStorage.getItem("username") || ""
    setUserRole(role)
    setUsername(user)

    if (role !== "admin") {
      router.push("/")
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Connect to WebSocket for real-time updates
        MLPredictionService.connectWebSocket()
        
        // Add listeners for real-time updates
        MLPredictionService.addListener('transfer_request_updated', handleTransferRequestUpdated)
        
        // Fetch initial data
        await fetchTransferRequests()
        
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
      MLPredictionService.removeListener('transfer_request_updated', handleTransferRequestUpdated)
    }
  }, [router])

  const fetchTransferRequests = async () => {
    try {
      const requests = await MLPredictionService.getTransferRequests()
      setTransferRequests(requests)
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Failed to fetch transfer requests:", err)
    }
  }

  const handleTransferRequestUpdated = (data: TransferRequest) => {
    setTransferRequests(prev => 
      prev.map(req => req.id === data.id ? data : req)
    )
    setNotifications(prev => [{
      id: Date.now(),
      type: 'transfer_update',
      title: 'Transfer Request Updated',
      message: `Transfer request ${data.id} status: ${data.status}`,
      timestamp: new Date()
    }, ...prev])
  }

  const handleApproveTransfer = async (requestId: string, targetDepartment: string) => {
    try {
      // Check bed availability
      const department = bedAvailability[targetDepartment as keyof typeof bedAvailability]
      if (!department || department.available === 0) {
        setError(`No beds available in ${targetDepartment}`)
        return
      }

      // Update transfer request status
      await MLPredictionService.updateTransferRequest(requestId, {
        status: "admin_approved",
        // admin id is stored by backend via update route; we pass it via notes for type compatibility
        notes: `approved by ${username}`,
        target_department: targetDepartment,
        updated_at: new Date().toISOString()
      } as any)

      // Update bed availability
      setBedAvailability(prev => ({
        ...prev,
        [targetDepartment]: {
          ...prev[targetDepartment as keyof typeof prev],
          available: prev[targetDepartment as keyof typeof prev].available - 1,
          occupied: prev[targetDepartment as keyof typeof prev].occupied + 1
        }
      }))

      // Refresh data
      await fetchTransferRequests()
      
      setNotifications(prev => [{
        id: Date.now(),
        type: 'transfer_approved',
        title: 'Transfer Approved',
        message: `Transfer approved and bed assigned in ${targetDepartment}`,
        timestamp: new Date()
      }, ...prev])

    } catch (err) {
      console.error("Failed to approve transfer:", err)
      setError("Failed to approve transfer request")
    }
  }

  const handleRejectTransfer = async (requestId: string, reason?: string) => {
    try {
      await MLPredictionService.updateTransferRequest(requestId, {
        status: "admin_rejected",
        notes: (reason || "Rejected by admin - no beds available") + ` (by ${username})`,
        updated_at: new Date().toISOString()
      } as any)
      
      // Refresh data
      await fetchTransferRequests()
      
      setNotifications(prev => [{
        id: Date.now(),
        type: 'transfer_rejected',
        title: 'Transfer Rejected',
        message: `Transfer rejected: ${reason || "No beds available"}`,
        timestamp: new Date()
      }, ...prev])

    } catch (err) {
      console.error("Failed to reject transfer:", err)
      setError("Failed to reject transfer request")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("username")
    router.push("/")
  }

  const handleRefresh = () => {
    fetchTransferRequests()
  }

  // Filter requests that need admin approval (doctor approved but not yet admin approved)
  const pendingAdminApproval = transferRequests.filter(r => r.status === "doctor_approved")
  const approvedTransfers = transferRequests.filter(r => r.status === "admin_approved")
  const rejectedTransfers = transferRequests.filter(r => r.status === "admin_rejected")

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Department Admin Panel</h1>
              <p className="text-blue-200 text-sm">Bed management & transfer approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{username}</p>
              <p className="text-blue-200 text-sm">{userRole}</p>
            </div>
            <ViewTransferredButton />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-blue-300 text-blue-100 hover:bg-blue-800 bg-transparent"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4">
        {error && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{pendingAdminApproval.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting admin review</p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Total Available Beds</CardTitle>
              <Bed className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(bedAvailability).reduce((sum, dept) => sum + dept.available, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Across all departments</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Approved Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{approvedTransfers.length}</div>
              <p className="text-xs text-muted-foreground">Transfers approved</p>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Rejected Today</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedTransfers.length}</div>
              <p className="text-xs text-muted-foreground">Transfers rejected</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bed Availability Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <Bed className="h-5 w-5" />
                Bed Occupancy Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(bedAvailability).map(([department, beds]) => (
                  <div key={department} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{department}</h4>
                      <Badge className={beds.available > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {beds.available > 0 ? `${beds.available} Available` : "No Beds"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg text-blue-600">{beds.total}</div>
                        <div className="text-gray-600">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-green-600">{beds.available}</div>
                        <div className="text-gray-600">Available</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-blue-600">{beds.occupied}</div>
                        <div className="text-gray-600">Occupied</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-yellow-600">{beds.cleaning}</div>
                        <div className="text-gray-600">Cleaning</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Doctor Approved Transfer Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Doctor Approved Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingAdminApproval.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No pending transfer approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingAdminApproval.map((request) => {
                    const targetDepartment = request.target_department || "General Ward"
                    const department = bedAvailability[targetDepartment as keyof typeof bedAvailability]
                    const hasBeds = department && department.available > 0
                    
                    return (
                      <div key={request.id} className="border border-orange-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <ArrowRightLeft className="h-8 w-8 text-orange-600" />
                            <div>
                              <h3 className="font-semibold text-gray-900">Transfer Request {request.id}</h3>
                              <p className="text-sm text-gray-600">Patient ID: {request.patient_id}</p>
                              <p className="text-sm text-gray-500">
                                Approved by {request.doctor_id} • {new Date(request.updated_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={hasBeds ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {hasBeds ? `${department.available} Beds Available` : "No Beds Available"}
                          </Badge>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Target Department</p>
                              <p className="text-sm">{targetDepartment}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">Doctor Approval</p>
                              <p className="text-sm">{request.doctor_id}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleApproveTransfer(request.id!, targetDepartment)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            disabled={!hasBeds}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve & Assign Bed
                          </Button>
                          <Button 
                            onClick={() => handleRejectTransfer(request.id!, "No beds available")}
                            variant="destructive" 
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject Transfer
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {(approvedTransfers.length > 0 || rejectedTransfers.length > 0) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Transfer Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...approvedTransfers, ...rejectedTransfers]
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .slice(0, 5)
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {request.status === "admin_approved" ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium">
                            {request.status === "admin_approved" ? "Approved" : "Rejected"}: Patient {request.patient_id}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(request.updated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        className={
                          request.status === "admin_approved" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {request.status === "admin_approved" ? "Approved" : "Rejected"}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
