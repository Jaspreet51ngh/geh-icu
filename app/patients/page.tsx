"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Users, Eye, Download } from "lucide-react"
import { TransferModal } from "@/components/transfer-modal"
import { TrendSparkline } from "@/components/trend-sparkline"

// Extended patient data for the dedicated patients page
const allPatients = [
  {
    id: "ICU-001",
    name: "Sarah Johnson",
    icuDays: 3,
    stabilityScore: 85,
    status: "Transfer Ready",
    statusColor: "bg-green-100 text-green-800",
    room: "ICU-A12",
    admissionReason: "Post-surgical monitoring",
    mlReason: "Stable vitals for 24hrs, low readmission risk (12%)",
    trendData: [65, 70, 75, 80, 85],
    transferProbability: 0.89,
    lastUpdated: "2 min ago",
  },
  {
    id: "ICU-002",
    name: "Michael Chen",
    icuDays: 1,
    stabilityScore: 45,
    status: "Critical",
    statusColor: "bg-red-100 text-red-800",
    room: "ICU-B03",
    admissionReason: "Cardiac arrest",
    mlReason: "Unstable cardiac markers, requires continued monitoring",
    trendData: [60, 55, 50, 48, 45],
    transferProbability: 0.15,
    lastUpdated: "1 min ago",
  },
  {
    id: "ICU-003",
    name: "Emily Rodriguez",
    icuDays: 5,
    stabilityScore: 72,
    status: "Monitoring",
    statusColor: "bg-yellow-100 text-yellow-800",
    room: "ICU-A08",
    admissionReason: "Respiratory failure",
    mlReason: "Improving trend, consider transfer in 12-24hrs",
    trendData: [55, 60, 65, 68, 72],
    transferProbability: 0.67,
    lastUpdated: "5 min ago",
  },
  {
    id: "ICU-004",
    name: "David Thompson",
    icuDays: 2,
    stabilityScore: 88,
    status: "Transfer Ready",
    statusColor: "bg-green-100 text-green-800",
    room: "ICU-C15",
    admissionReason: "Trauma recovery",
    mlReason: "Excellent recovery trajectory, ready for step-down",
    trendData: [70, 75, 80, 85, 88],
    transferProbability: 0.94,
    lastUpdated: "3 min ago",
  },
  {
    id: "ICU-005",
    name: "Lisa Wang",
    icuDays: 4,
    stabilityScore: 63,
    status: "Monitoring",
    statusColor: "bg-yellow-100 text-yellow-800",
    room: "ICU-B07",
    admissionReason: "Sepsis treatment",
    mlReason: "Plateau in recovery, reassess in 24hrs",
    trendData: [58, 61, 64, 62, 63],
    transferProbability: 0.43,
    lastUpdated: "7 min ago",
  },
  {
    id: "ICU-006",
    name: "Robert Kim",
    icuDays: 6,
    stabilityScore: 78,
    status: "Transfer Ready",
    statusColor: "bg-green-100 text-green-800",
    room: "ICU-A05",
    admissionReason: "Post-operative care",
    mlReason: "Consistent improvement, cleared for transfer",
    trendData: [60, 65, 70, 75, 78],
    transferProbability: 0.82,
    lastUpdated: "4 min ago",
  },
]

export default function PatientsPage() {
  const [selectedPatient, setSelectedPatient] = useState<(typeof allPatients)[0] | null>(null)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("icuDays")

  const handleViewPatient = (patient: (typeof allPatients)[0]) => {
    setSelectedPatient(patient)
    setIsTransferModalOpen(true)
  }

  const filteredAndSortedPatients = allPatients
    .filter((patient) => {
      const matchesSearch =
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || patient.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "icuDays":
          return b.icuDays - a.icuDays
        case "stabilityScore":
          return b.stabilityScore - a.stabilityScore
        case "transferProbability":
          return b.transferProbability - a.transferProbability
        default:
          return 0
      }
    })

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Users className="h-6 w-6 text-teal-600" />
          Patient Management
        </h1>
        <p className="text-slate-600">Comprehensive view of all ICU patients with AI-powered insights</p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
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
                <SelectItem value="Transfer Ready">Transfer Ready</SelectItem>
                <SelectItem value="Monitoring">Monitoring</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="icuDays">ICU Days</SelectItem>
                <SelectItem value="stabilityScore">Stability Score</SelectItem>
                <SelectItem value="transferProbability">Transfer Probability</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-800">{allPatients.length}</div>
            <div className="text-sm text-slate-600">Total Patients</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {allPatients.filter((p) => p.status === "Transfer Ready").length}
            </div>
            <div className="text-sm text-slate-600">Transfer Ready</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {allPatients.filter((p) => p.status === "Monitoring").length}
            </div>
            <div className="text-sm text-slate-600">Monitoring</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {allPatients.filter((p) => p.status === "Critical").length}
            </div>
            <div className="text-sm text-slate-600">Critical</div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Patient Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Details</CardTitle>
          <CardDescription>
            Showing {filteredAndSortedPatients.length} of {allPatients.length} patients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient Info</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>ICU Days</TableHead>
                <TableHead>Admission Reason</TableHead>
                <TableHead>Stability Trend</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Confidence</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-slate-500">{patient.id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{patient.room}</TableCell>
                  <TableCell>{patient.icuDays}</TableCell>
                  <TableCell className="max-w-xs truncate">{patient.admissionReason}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{patient.stabilityScore}%</span>
                      <TrendSparkline data={patient.trendData} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={patient.statusColor}>{patient.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                          style={{ width: `${patient.transferProbability * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">{Math.round(patient.transferProbability * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{patient.lastUpdated}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPatient(patient)}
                      className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferModal
        patient={selectedPatient}
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  )
}
