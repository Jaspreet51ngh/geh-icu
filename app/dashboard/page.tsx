"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Activity,
  User,
  AlertTriangle,
  TrendingUp,
  LogOut,
  Stethoscope,
  Monitor,
  Brain,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react"
import { PatientCard } from "@/components/patient-card"
import { TransferRequestModal } from "@/components/transfer-request-modal"
import { NotificationPanel } from "@/components/notification-panel"
import { MLPredictionService, type Patient, type TransferRequest } from "@/lib/ml-service"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()

  // Initialize WebSocket connection and fetch data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)
        
        // Connect to WebSocket for real-time updates
        MLPredictionService.connectWebSocket()
        
        // Add listeners for real-time updates
        MLPredictionService.addListener('vitals_update', handleVitalsUpdate)
        MLPredictionService.addListener('transfer_request_created', handleTransferRequestCreated)
        MLPredictionService.addListener('transfer_request_updated', handleTransferRequestUpdated)
        
        // Fetch initial data
        await fetchPatients()
        await fetchTransferRequests()
        
        setError(null)
      } catch (err) {
        setError("Failed to connect to backend. Please check if the server is running.")
        console.error("Initialization error:", err)
      } finally {
        setLoading(false)
      }
    }

    initializeData()

    // Cleanup listeners on unmount
    return () => {
      MLPredictionService.removeListener('vitals_update', handleVitalsUpdate)
      MLPredictionService.removeListener('transfer_request_created', handleTransferRequestCreated)
      MLPredictionService.removeListener('transfer_request_updated', handleTransferRequestUpdated)
    }
  }, [])

  const fetchPatients = async () => {
    try {
      const patientData = await MLPredictionService.getAllPatients()
      setPatients(patientData)
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Failed to fetch patients:", err)
      setError("Failed to fetch patient data")
    }
  }

  const fetchTransferRequests = async () => {
    try {
      const requests = await MLPredictionService.getTransferRequests()
      setTransferRequests(requests)
    } catch (err) {
      console.error("Failed to fetch transfer requests:", err)
    }
  }

  const handleVitalsUpdate = (data: any) => {
    setPatients(prevPatients => 
      prevPatients.map(patient => 
        patient.id === data.patient_id 
          ? { 
              ...patient, 
              vitals: { 
                ...patient.vitals,
                heartRate: data.heartRate,
                spO2: data.spO2,
                respiratoryRate: data.respiratoryRate,
                systolicBP: data.systolicBP,
                lactate: data.lactate,
                gcs: data.gcs
              },
              lastUpdated: new Date()
            }
          : patient
      )
    )
    setLastUpdate(new Date())
  }

  const handleTransferRequestCreated = (data: TransferRequest) => {
    setTransferRequests(prev => [...prev, data])
    setNotifications(prev => [{
      id: Date.now(),
      type: 'transfer_request',
      title: 'New Transfer Request',
      message: `Transfer request created for patient ${data.patient_id}`,
      timestamp: new Date()
    }, ...prev])
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

  const handleTransferRequest = (patient: Patient) => {
    setSelectedPatient(patient)
    setShowTransferModal(true)
  }

  const handleLogout = () => {
    router.push("/")
  }

  const handleRefresh = () => {
    fetchPatients()
    fetchTransferRequests()
  }

  // Calculate dashboard statistics
  const totalPatients = patients.length
  const transferReadyPatients = patients.filter(p => p.prediction?.transferReady).length
  const criticalPatients = patients.filter(p => p.prediction?.confidence < 0.3).length
  const pendingTransfers = transferRequests.filter(r => r.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Connecting to ICU monitoring system...</p>
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
                <Activity className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">ICU Dashboard</h1>
              </div>
              <div className="text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPatients}</div>
              <p className="text-xs text-muted-foreground">
                Currently in ICU
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transfer Ready</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{transferReadyPatients}</div>
              <p className="text-xs text-muted-foreground">
                Ready for transfer
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Patients</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{criticalPatients}</div>
              <p className="text-xs text-muted-foreground">
                Require attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingTransfers}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Patient Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onTransferRequest={() => handleTransferRequest(patient)}
              transferRequests={transferRequests}
            />
          ))}
        </div>

        {patients.length === 0 && !loading && (
          <div className="text-center py-12">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
            <p className="text-gray-500">Check your connection to the backend server.</p>
          </div>
        )}
      </div>

      {/* Transfer Request Modal */}
      {selectedPatient && (
        <TransferRequestModal
          patient={selectedPatient}
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false)
            setSelectedPatient(null)
          }}
          userRole="Nurse"
        />
      )}

      {/* Notification Panel */}
      <NotificationPanel 
        notifications={notifications}
        onClearNotification={(id) => 
          setNotifications(prev => prev.filter(n => n.id !== id))
        }
      />
    </div>
  )
}
