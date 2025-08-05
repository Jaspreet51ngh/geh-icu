"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Search, Download, Filter, LogOut, ArrowRightLeft } from "lucide-react"
import { useRouter } from "next/navigation"

// Mock transfer history data
const mockTransferHistory = [
  {
    id: "TR-001",
    patientId: "ICU-001",
    patientName: "Sarah Johnson",
    fromDepartment: "ICU",
    toDepartment: "General Ward",
    requestedBy: "Nurse Kelly",
    approvedByDoctor: "Dr. Smith",
    approvedByDept: "Admin Jones",
    status: "Approved",
    requestTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    completedTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
  },
  {
    id: "TR-002",
    patientId: "ED-002",
    patientName: "Michael Chen",
    fromDepartment: "ED",
    toDepartment: "ICU",
    requestedBy: "Nurse Maria",
    approvedByDoctor: "Dr. Johnson",
    approvedByDept: "Admin Smith",
    status: "Approved",
    requestTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    completedTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: "TR-003",
    patientId: "GEN-003",
    patientName: "Emily Rodriguez",
    fromDepartment: "General Ward",
    toDepartment: "ICU",
    requestedBy: "Nurse David",
    approvedByDoctor: "Dr. Wilson",
    approvedByDept: null,
    status: "Rejected",
    requestTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
    completedTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "TR-004",
    patientId: "ICU-004",
    patientName: "David Thompson",
    fromDepartment: "ICU",
    toDepartment: "General Ward",
    requestedBy: "Nurse Sarah",
    approvedByDoctor: "Dr. Brown",
    approvedByDept: "Admin Davis",
    status: "Approved",
    requestTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
    completedTime: new Date(Date.now() - 7 * 60 * 60 * 1000),
  },
]

export default function TransferLogPage() {
  const [transfers, setTransfers] = useState(mockTransferHistory)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    const user = localStorage.getItem("username") || ""
    const role = localStorage.getItem("userRole") || ""
    setUsername(user)

    if (!role) {
      router.push("/")
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("username")
    router.push("/")
  }

  const handleExport = () => {
    // Simulate CSV export
    const csvContent = transfers
      .map(
        (t) =>
          `${t.patientId},${t.patientName},${t.fromDepartment},${t.toDepartment},${t.requestedBy},${t.status},${t.requestTime.toISOString()}`,
      )
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "transfer-log.csv"
    a.click()
  }

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      transfer.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.patientId.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter

    const matchesDepartment =
      departmentFilter === "all" ||
      transfer.fromDepartment === departmentFilter ||
      transfer.toDepartment === departmentFilter

    return matchesSearch && matchesStatus && matchesDepartment
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="status-normal">Approved</Badge>
      case "Rejected":
        return <Badge className="status-risky">Rejected</Badge>
      case "Pending":
        return <Badge className="status-elevated">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="teal-header text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Transfer History Log</h1>
              <p className="text-blue-200 text-sm">Complete audit trail of patient transfers</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{username}</p>
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
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-teal-primary flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="ICU">ICU</SelectItem>
                  <SelectItem value="General Ward">General Ward</SelectItem>
                  <SelectItem value="ED">ED</SelectItem>
                  <SelectItem value="Cardiac Unit">Cardiac Unit</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleExport} variant="outline" className="flex items-center gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{transfers.length}</div>
              <div className="text-sm text-slate-600">Total Transfers</div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {transfers.filter((t) => t.status === "Approved").length}
              </div>
              <div className="text-sm text-slate-600">Approved</div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {transfers.filter((t) => t.status === "Rejected").length}
              </div>
              <div className="text-sm text-slate-600">Rejected</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round((transfers.filter((t) => t.status === "Approved").length / transfers.length) * 100)}%
              </div>
              <div className="text-sm text-slate-600">Success Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-teal-primary">Transfer History</CardTitle>
            <p className="text-sm text-slate-600">
              Showing {filteredTransfers.length} of {transfers.length} transfers
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Transfer Route</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Doctor Approval</TableHead>
                  <TableHead>Dept Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Request Time</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transfer.patientName}</div>
                        <div className="text-sm text-slate-500">{transfer.patientId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{transfer.fromDepartment}</span>
                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                        <span className="text-sm">{transfer.toDepartment}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{transfer.requestedBy}</TableCell>
                    <TableCell className="text-sm">{transfer.approvedByDoctor}</TableCell>
                    <TableCell className="text-sm">{transfer.approvedByDept || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    <TableCell className="text-sm">
                      {transfer.requestTime.toLocaleDateString()} {transfer.requestTime.toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {transfer.completedTime.toLocaleDateString()} {transfer.completedTime.toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
