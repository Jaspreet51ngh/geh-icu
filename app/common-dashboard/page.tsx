"use client"
// @ts-nocheck

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Filter, Download, Users } from 'lucide-react'

export default function CommonDashboard() {
  const [rows, setRows] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('all')

  useEffect(() => {
    fetch('http://localhost:8000/discharged-patients').then(async (r) => {
      const data = await r.json()
      setRows(data)
    }).catch(console.error)
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const s = search.toLowerCase()
      const matches = (r.name || '').toLowerCase().includes(s) || (r.patient_id || '').toLowerCase().includes(s)
      const matchesDept = dept === 'all' || r.target_department === dept
      return matches && matchesDept
    })
  }, [rows, search, dept])

  const exportCSV = () => {
    const csv = filtered.map((t) => `${t.patient_id},${t.name},${t.time_discharged},${t.target_department},${t.approved_by_nurse || ''},${t.approved_by_doctor || ''},${t.approved_by_admin || ''}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'common-dashboard.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-6 w-6 text-teal-600" />
        <h1 className="text-xl font-bold text-slate-800">Common Discharge Dashboard</h1>
      </div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800"><Filter className="h-4 w-4"/> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-center">
            <Input placeholder="Search by name or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs"/>
            <Input placeholder="Filter by department (exact)" value={dept === 'all' ? '' : dept} onChange={(e) => setDept(e.target.value || 'all')} className="max-w-xs"/>
            <Button onClick={exportCSV} variant="outline" className="flex items-center gap-2"><Download className="h-4 w-4"/>Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-800">Patients Moved Out of ICU</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Move Time</TableHead>
                <TableHead>Moved Department</TableHead>
                <TableHead>Approved by Nurse</TableHead>
                <TableHead>Approved by Doctor</TableHead>
                <TableHead>Approved by Admin</TableHead>
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
  )
}


