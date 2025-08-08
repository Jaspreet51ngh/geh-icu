"use client"
// @ts-nocheck

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Search, Download, Users } from "lucide-react"
import { MLPredictionService } from "@/lib/ml-service"

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

export default function CommonDashboardPage() {
  const [rows, setRows] = useState<DischargedRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const load = async () => {
    try {
      const data = await MLPredictionService.getDischargedPatients()
      setRows(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    MLPredictionService.connectWebSocket()
    load()
    // refresh on WS discharge notifications
    const onDischarged = () => load()
    MLPredictionService.addListener('patient_discharged', onDischarged)
    return () => {
      MLPredictionService.removeListener('patient_discharged', onDischarged)
    }
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = searchTerm.toLowerCase()
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.patient_id || '').toLowerCase().includes(q) ||
        (r.target_department || '').toLowerCase().includes(q)
      )
    })
  }, [rows, searchTerm])

  const handleExport = () => {
    const csvContent = filtered
      .map((t) => `${t.patient_id},${t.name},${t.time_discharged},${t.target_department},${t.approved_by_nurse || ''},${t.approved_by_doctor || ''},${t.approved_by_admin || ''}`)
      .join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "discharged-patients.csv"
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-teal-600" />
          <h1 className="text-xl font-semibold">Common Dashboard — Discharged Patients</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Discharged Patients</CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search" className="pl-9" />
              </div>
              <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ICU ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Moved Time</TableHead>
                  <TableHead>Moved Department</TableHead>
                  <TableHead>Approved By (Nurse)</TableHead>
                  <TableHead>Approved By (Doctor)</TableHead>
                  <TableHead>Approved By (Admin)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={`${t.transfer_request_id}-${t.patient_id}`}>
                    <TableCell>{t.patient_id}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{new Date(t.time_discharged).toLocaleString()}</TableCell>
                    <TableCell>{t.target_department}</TableCell>
                    <TableCell>{t.approved_by_nurse || '—'}</TableCell>
                    <TableCell>{t.approved_by_doctor || '—'}</TableCell>
                    <TableCell>{t.approved_by_admin || '—'}</TableCell>
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

