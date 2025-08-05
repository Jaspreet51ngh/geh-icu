"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Bed, ArrowRightLeft, Shield, LogOut, Users } from "lucide-react"
import { useRouter } from "next/navigation"

// Mock incoming transfer requests for department admins
const mockIncomingRequests = [
  {
    id: "TR-001",
    patientId: "ICU-001",
    patientName: "Sarah Johnson",
    fromDepartment: "ICU",
    toDepartment: "General Ward",
    doctorApproved: "Dr. Smith",
    approvedTime: new Date(Date.now() - 15 * 60000),
    status: "pending_department",
    bedAvailable: true,
  },
  {
    id: "TR-003",
    patientId: "ED-005",
    patientName: "Robert Kim",
    fromDepartment: "ED",
    toDepartment: "ICU",
    doctorApproved: "Dr. Johnson",
    approvedTime: new Date(Date.now() - 25 * 60000),
    status: "pending_department",
    bedAvailable: false,
  },
]

export default function AdminDashboardPage() {
  const [requests, setRequests] = useState(mockIncomingRequests)
  const [userRole, setUserRole] = useState("")
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    const role = localStorage.getItem("userRole") || ""
    const user = localStorage.getItem("username") || ""
    setUserRole(role)
    setUsername(user)

    if (!role.includes("Admin")) {
      router.push("/dashboard")
    }
  }, [router])

  const handleApprove = (requestId: string) => {
    setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "approved" } : req)))

    const request = requests.find((r) => r.id === requestId)
    alert(`Transfer approved! ${request?.patientName} bed assigned. System updated.`)
  }

  const handleReject = (requestId: string) => {
    setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "rejected" } : req)))

    const request = requests.find((r) => r.id === requestId)
    alert(`Transfer rejected. Doctor and nurse notified about ${request?.patientName}.`)
  }

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("username")
    router.push("/")
  }

  const pendingRequests = requests.filter((req) => req.status === "pending_department")
  const relevantRequests = pendingRequests.filter(
    (req) =>
      userRole.includes(req.toDepartment) ||
      (userRole === "ICU Admin" && req.toDepartment === "ICU") ||
      (userRole === "General Ward Admin" && req.toDepartment === "General Ward") ||
      (userRole === "ED Admin" && req.toDepartment === "ED"),
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="teal-header text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Department Admin Panel</h1>
              <p className="text-blue-200 text-sm">Incoming transfer approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{username}</p>
              <p className="text-blue-200 text-sm">{userRole}</p>
            </div>
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{relevantRequests.length}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Available Beds</CardTitle>
              <Bed className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">8</div>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Transfers Today</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">12</div>
            </CardContent>
          </Card>
        </div>

        {/* Incoming Transfer Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-teal-primary">Incoming Transfer Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {relevantRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No pending transfer requests for your department</p>
              </div>
            ) : (
              <div className="space-y-4">
                {relevantRequests.map((request) => (
                  <div key={request.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <ArrowRightLeft className="h-8 w-8 text-teal-secondary" />
                        <div>
                          <h3 className="font-semibold text-teal-primary">{request.patientName}</h3>
                          <p className="text-sm text-slate-600">{request.patientId}</p>
                          <p className="text-sm text-slate-500">
                            Approved by {request.doctorApproved} • {request.approvedTime.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={request.bedAvailable ? "status-normal" : "status-risky"}>
                        {request.bedAvailable ? "Bed Available" : "No Beds"}
                      </Badge>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Transfer Route</p>
                          <p className="text-sm">
                            {request.fromDepartment} → {request.toDepartment}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Doctor Approval</p>
                          <p className="text-sm">{request.doctorApproved}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={!request.bedAvailable}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve & Assign Bed
                      </Button>
                      <Button onClick={() => handleReject(request.id)} variant="destructive" className="flex-1">
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Transfer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bed Management */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-teal-primary flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Bed Occupancy Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">8</div>
                <div className="text-sm text-green-800">Available</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">15</div>
                <div className="text-sm text-blue-800">Occupied</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">2</div>
                <div className="text-sm text-yellow-800">Cleaning</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">1</div>
                <div className="text-sm text-red-800">Maintenance</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
