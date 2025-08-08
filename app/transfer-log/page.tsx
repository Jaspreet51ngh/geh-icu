"use client"
// @ts-nocheck

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Search, Download, Filter, LogOut, ArrowRightLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface DischargedRow {
  patient_id: string
  name: string
  time_discharged: string
  target_department: string
  approved_by_nurse?: string | null
  approved_by_doctor?: string | null
  approved_by_admin?: string | null
  transfer_request_id: number
}

export default function TransferLogPage() {
  const [rows, setRows] = useState<DischargedRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    const user = localStorage.getItem("username") || ""
    setUsername(user)
    // Open access per spec; do not redirect by role
    fetch("http://localhost:8000/discharged-patients").then(async (r: Response) => {
      const data: DischargedRow[] = await r.json()
      setRows(data)
    }).catch(console.error)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("username")
    router.push("/")
  }

  const filtered = useMemo(() => {
    return rows.filter((r: DischargedRow) => {
      const matchesSearch =
        (r.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.patient_id || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDept = departmentFilter === 'all' || r.target_department === departmentFilter
      return matchesSearch && matchesDept
    })
  }, [rows, searchTerm, departmentFilter])

  const handleExport = () => {
    const csvContent = filtered
      .map((t: DischargedRow) => `${t.patient_id},${t.name},${t.time_discharged},${t.target_department},${t.approved_by_nurse || ''},${t.approved_by_doctor || ''},${t.approved_by_admin || ''}`)
      .join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "discharged-patients-log.csv"
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="teal-header text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Discharged Patients Log</h1>
              <p className="text-blue-200 text-sm">All transferred patients from ICU</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{username}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-blue-300 text-blue-100 hover:bg-blue-800 bg-transparent">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4">
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
                <Input placeholder="Search patients..." value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="General Ward">General Ward</SelectItem>
                  <SelectItem value="ED">ED</SelectItem>
                  <SelectItem value="Cardiac Unit">Cardiac Unit</SelectItem>
                  <SelectItem value="Surgical Ward">Surgical Ward</SelectItem>
                  <SelectItem value="Step-Down Unit">Step-Down Unit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExport} variant="outline" className="flex items-center gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-teal-primary">Transfer History</CardTitle>
            <p className="text-sm text-slate-600">Showing {filtered.length} of {rows.length} discharges</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Time Discharged</TableHead>
                  <TableHead>Shifted To</TableHead>
                  <TableHead>Approved by Nurse</TableHead>
                  <TableHead>Approved by Doctor</TableHead>
                  <TableHead>Approved by Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={`${t.transfer_request_id}-${t.patient_id}`}>
                    <TableCell className="text-sm">{t.patient_id}</TableCell>
                    <TableCell className="text-sm">{t.name}</TableCell>
                    <TableCell className="text-sm">{new Date(t.time_discharged).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{t.target_department}</TableCell>
                    <TableCell className="text-sm">{t.approved_by_nurse || '—'}</TableCell>
                    <TableCell className="text-sm">{t.approved_by_doctor || '—'}</TableCell>
                    <TableCell className="text-sm">{t.approved_by_admin || '—'}</TableCell>
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