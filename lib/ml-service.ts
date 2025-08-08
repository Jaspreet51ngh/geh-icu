// ML Prediction Service for ICU Transfer Readiness
export interface PatientVitals {
  heartRate: number
  spO2: number
  temperature?: number
  systolicBP: number
  diastolicBP?: number
  respiratoryRate: number
  gcs: number
  lactate: number
  meanBP?: number
  centralVenousPressure?: number
}

export interface LabValues {
  lactate: number
  creatinine?: number
  bilirubin?: number
  hemoglobin?: number
  platelets?: number
  whiteBloodCells?: number
}

export interface Patient {
  id: string
  name: string
  age: number
  vitals: PatientVitals
  labValues?: LabValues
  comorbidities?: string[]
  onVentilator: boolean
  onPressors: boolean
  lengthOfStay?: number
  admissionType?: string
  comorbidityScore?: number
  prediction?: {
    transferReady: boolean
    confidence: number
    reasoning: string
    riskFactors: string[]
    timestamp?: string
  }
  lastUpdated?: string
}

// Rich prediction used by frontend Patient.prediction shape
export interface RichPrediction {
  transferReady: boolean
  confidence: number
  reasoning: string
  riskFactors: string[]
  timestamp?: string
}

export interface TransferRequest {
  id?: string
  patient_id: string
  nurse_id: string
  doctor_id?: string | null
  department_admin_id?: string | null
  status: "pending" | "doctor_approved" | "admin_approved" | "doctor_rejected" | "admin_rejected" | "rejected" | "completed"
  target_department?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  ml_prediction?: any
}

export class MLPredictionService {
  private static readonly API_BASE_URL = "http://localhost:8000"
  private static ws: WebSocket | null = null
  private static listeners: Map<string, Function[]> = new Map()
  private static isReconnecting: boolean = false
  private static patientDataCallback: ((patients: Patient[]) => void) | null = null
  private static transferRequestCallback: ((requests: TransferRequest[]) => void) | null = null

  static connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    if (this.isReconnecting) {
      return
    }

    this.isReconnecting = true

    try {
      this.ws = new WebSocket(`${this.API_BASE_URL.replace('http', 'ws')}/ws`)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected for real-time updates')
        this.isReconnecting = false
      }
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket message received:', data)
          this.notifyListeners(data.type, data.data)
          
          if (data.type === 'vitals_update' || data.type === 'patient_updated' || data.type === 'patient_discharged') {
            this.triggerPatientDataRefresh()
          }
          if (data.type === 'transfer_request_created' || data.type === 'transfer_request_updated' || data.type === 'patient_discharged') {
            this.triggerTransferRequestRefresh()
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.isReconnecting = false
      }
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...')
        this.isReconnecting = false
        setTimeout(() => this.connectWebSocket(), 5000)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.isReconnecting = false
    }
  }

  static addListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  static removeListener(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private static notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in event listener callback:', error)
        }
      })
    }
  }

  static setPatientDataCallback(callback: (patients: Patient[]) => void) {
    this.patientDataCallback = callback
  }

  static setTransferRequestCallback(callback: (requests: TransferRequest[]) => void) {
    this.transferRequestCallback = callback
  }

  static triggerPatientDataRefresh() {
    if (this.patientDataCallback) {
      this.getAllPatients().then(this.patientDataCallback).catch(console.error)
    }
  }

  static triggerTransferRequestRefresh() {
    if (this.transferRequestCallback) {
      this.getTransferRequests().then(this.transferRequestCallback).catch(console.error)
    }
  }

  static async callMLAPI(patient: Patient): Promise<RichPrediction> {
    try {
      const payload = {
        HR: patient.vitals.heartRate,
        SpO2: patient.vitals.spO2,
        RESP: patient.vitals.respiratoryRate,
        ABPsys: patient.vitals.systolicBP,
        lactate: patient.vitals.lactate,
        gcs: patient.vitals.gcs,
        age: patient.age,
        comorbidity_score: patient.comorbidityScore || this.calculateComorbidityScore(patient.comorbidities),
        on_vent: patient.onVentilator,
        on_pressors: patient.onPressors
      }

      const response = await fetch(`${this.API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const result = await response.json()

      return {
        transferReady: result.prediction === "Ready" || result.prediction === 1,
        confidence: result.confidence || result.probability,
        reasoning: result.explanation || result.reasoning || "ML model prediction",
        riskFactors: result.risk_factors || result.features || [],
        timestamp: result.timestamp
      }
    } catch (error) {
      console.warn("ML API unavailable, using fallback prediction:", error)
      return this.fallbackPrediction(patient)
    }
  }

  static async getAllPatients(): Promise<Patient[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/patients`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`)
      }
      
      const patients = await response.json()
      console.log(`Retrieved ${patients.length} patients from API`)
      return patients
    } catch (error) {
      console.error("Failed to fetch patients:", error)
      throw error
    }
  }

  static async getPatientVitals(patientId: string): Promise<PatientVitals> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/patient/${patientId}/vitals`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Failed to fetch patient vitals:", error)
      throw error
    }
  }

  static async getTransferRequests(): Promise<TransferRequest[]> {
    try {
      console.log('Fetching transfer requests...')
      
      const response = await fetch(`${this.API_BASE_URL}/transfer-requests`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`)
      }
      
      const requests = await response.json()
      console.log(`Retrieved ${requests.length} transfer requests from API`)
      return requests
    } catch (error) {
      console.error("Failed to fetch transfer requests:", error)
      throw error
    }
  }

  static async createTransferRequest(request: Omit<TransferRequest, 'id'>): Promise<TransferRequest> {
    try {
      console.log('Creating transfer request:', request)
      
      const response = await fetch(`${this.API_BASE_URL}/transfer-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Transfer request failed:', errorText)
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Transfer request created successfully:', result)
      
      return {
        id: result.id || result.request_id,
        ...request,
        ...result.data
      }
    } catch (error) {
      console.error("Failed to create transfer request:", error)
      throw error
    }
  }

  static async updateTransferRequest(requestId: string, updateData: Partial<TransferRequest>): Promise<TransferRequest> {
    try {
      console.log(`Updating transfer request ${requestId}:`, updateData)
      
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateData,
          updated_at: new Date().toISOString()
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Transfer request update failed:', errorText)
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Transfer request updated successfully:', result)
      return result.data
    } catch (error) {
      console.error("Failed to update transfer request:", error)
      throw error
    }
  }

  static async rejectTransferRequest(requestId: string, doctorId: string, notes?: string): Promise<TransferRequest> {
    try {
      console.log(`Rejecting transfer request ${requestId} by doctor ${doctorId}`)
      
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId, notes: notes || "Transfer request rejected by doctor" })
      })
  
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }
  
      const result = await response.json()
      console.log('Transfer request rejected successfully:', result)
      return result.data
    } catch (error) {
      console.error("Failed to reject transfer request:", error)
      throw error
    }
  }

  static async approveTransferRequest(
    requestId: string, 
    doctorId: string, 
    targetDepartment: string, 
    notes?: string
  ): Promise<TransferRequest> {
    try {
      console.log(`Approving transfer request ${requestId} by doctor ${doctorId} to ${targetDepartment}`)
      
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId, target_department: targetDepartment, notes: notes || "Transfer approved by doctor" })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }
  
      const result = await response.json()
      console.log('Transfer request approved successfully:', result)
      return result.data
    } catch (error) {
      console.error("Failed to approve transfer request:", error)
      throw error
    }
  }

  static async adminApproveTransferRequest(
    requestId: string,
    adminId: string,
    targetDepartment: string,
    notes?: string
  ): Promise<TransferRequest> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}/admin-approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId, target_department: targetDepartment, notes: notes || "Transfer approved by admin" })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }
      const result = await response.json()
      return result.data
    } catch (error) {
      console.error("Failed to admin-approve transfer request:", error)
      throw error
    }
  }

  static async dischargePatient(requestId: string, nurseId: string, notes?: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: nurseId, notes: notes || "" })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Failed to discharge patient:", error)
      throw error
    }
  }

  static async addNewPatient(payload: {
    name: string
    age: number
    gender?: string
    vitals?: Partial<PatientVitals>
  }): Promise<{ success: boolean }> {
    const body: any = {
      name: payload.name,
      age: payload.age,
      gender: payload.gender || 'Unknown',
      vitals: payload.vitals || {},
    }
    const res = await fetch(`${this.API_BASE_URL}/add-patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to add patient')
    return await res.json()
  }

  static async getDischargedPatients(): Promise<{
    patient_id: string
    name: string
    time_discharged: string
    target_department: string
    approved_by_nurse?: string | null
    approved_by_doctor?: string | null
    approved_by_admin?: string | null
    transfer_request_id: number
  }[]> {
    const res = await fetch(`${this.API_BASE_URL}/discharged-patients`)
    if (!res.ok) throw new Error('Failed to fetch discharged patients')
    return await res.json()
  }

  private static fallbackPrediction(patient: Patient): RichPrediction {
    try {
      const sofaScore = this.calculateSOFAScore(patient)
      const vitalStability = this.assessVitalStability(patient.vitals)
      const riskFactors = this.identifyRiskFactors(patient)

      let transferReady = true
      let confidence = 0.8
      let reasoning = ""

      if (patient.onVentilator || patient.onPressors) {
        transferReady = false
        confidence = 0.95
        reasoning = "Patient requires intensive care support (ventilator/pressors)"
      } else if (sofaScore >= 6) {
        transferReady = false
        confidence = 0.9
        reasoning = "High SOFA score indicates multi-organ dysfunction"
      } else if (patient.vitals.lactate > 4.0) {
        transferReady = false
        confidence = 0.88
        reasoning = "Elevated lactate suggests ongoing tissue hypoperfusion"
      } else if (patient.vitals.gcs < 13) {
        transferReady = false
        confidence = 0.85
        reasoning = "Altered mental status requires continued ICU monitoring"
      } else if (vitalStability < 0.7) {
        transferReady = false
        confidence = 0.8
        reasoning = "Unstable vital signs require continued intensive monitoring"
      } else {
        transferReady = true
        confidence = Math.min(0.95, 0.7 + vitalStability * 0.25)
        reasoning = "Stable vitals, improving clinical parameters, suitable for step-down care"
      }

      return {
        transferReady,
        confidence,
        reasoning,
        riskFactors,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error("ML Prediction Error:", error)
      return {
        transferReady: false,
        confidence: 0.5,
        reasoning: "Unable to assess - requires clinical evaluation",
        riskFactors: ["Assessment unavailable"],
        timestamp: new Date().toISOString()
      }
    }
  }

  private static calculateSOFAScore(patient: Patient): number {
    let sofa = 0
    if (patient.vitals.spO2 < 90) sofa += 3
    else if (patient.vitals.spO2 < 95) sofa += 2
    else if (patient.vitals.spO2 < 98) sofa += 1

    const map = (patient.vitals.systolicBP + 2 * (patient.vitals.diastolicBP || 60)) / 3
    if (patient.onPressors) sofa += 4
    else if (map < 70) sofa += 1

    if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 12) sofa += 4
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 6) sofa += 3
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 2) sofa += 2
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 1.2) sofa += 1

    if (patient.labValues?.creatinine && patient.labValues.creatinine >= 5) sofa += 4
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 3.5) sofa += 3
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 2) sofa += 2
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 1.2) sofa += 1

    if (patient.vitals.gcs < 6) sofa += 4
    else if (patient.vitals.gcs < 10) sofa += 3
    else if (patient.vitals.gcs < 13) sofa += 2
    else if (patient.vitals.gcs < 15) sofa += 1

    return sofa
  }

  private static calculateComorbidityScore(comorbidities?: string[]): number {
    if (!comorbidities) return 0
    
    const weights: { [key: string]: number } = {
      Diabetes: 1,
      Hypertension: 1,
      CAD: 2,
      CKD: 2,
      COPD: 2,
      Cancer: 3,
      Cirrhosis: 3,
    }

    return comorbidities.reduce((score, condition) => {
      return score + (weights[condition] || 0)
    }, 0)
  }

  

  private static assessVitalStability(vitals: PatientVitals): number {
    let stability = 1.0

    if (vitals.heartRate < 60 || vitals.heartRate > 120) stability -= 0.2
    else if (vitals.heartRate < 50 || vitals.heartRate > 140) stability -= 0.4

    if (vitals.spO2 < 95) stability -= 0.3
    else if (vitals.spO2 < 92) stability -= 0.5

    const map = (vitals.systolicBP + 2 * (vitals.diastolicBP || 60)) / 3
    if (map < 65 || vitals.systolicBP > 180) stability -= 0.3

    if (vitals.temperature && (vitals.temperature > 101.5 || vitals.temperature < 96)) stability -= 0.2

    if (vitals.respiratoryRate > 24 || vitals.respiratoryRate < 12) stability -= 0.2

    return Math.max(0, stability)
  }

  private static identifyRiskFactors(patient: Patient): string[] {
    const factors: string[] = []

    if (patient.onVentilator) factors.push("Mechanical ventilation")
    if (patient.onPressors) factors.push("Vasopressor support")
    if (patient.vitals.gcs < 15) factors.push("Altered mental status")
    if (patient.vitals.lactate > 2.0) factors.push("Elevated lactate")
    if (patient.labValues?.creatinine && patient.labValues.creatinine > 1.5) factors.push("Renal dysfunction")
    if (patient.vitals.spO2 < 95) factors.push("Hypoxemia")
    if (patient.age > 70) factors.push("Advanced age")
    if (patient.comorbidities && patient.comorbidities.length > 2) factors.push("Multiple comorbidities")

    return factors.length > 0 ? factors : ["Low risk profile"]
  }

  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`)
      return response.ok
    } catch (error) {
      console.error("Connection test failed:", error)
      return false
    }
  }

  static async getModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/model-info`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error("Failed to get model info:", error)
      throw error
    }
  }

  static initialize() {
    console.log('Initializing MLPredictionService...')
    this.connectWebSocket()
    
    this.testConnection().then(connected => {
      console.log(`API connection ${connected ? 'successful' : 'failed'}`)
    })
  }

  static cleanup() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
    console.log('MLPredictionService cleaned up')
  }
}

// Minimal endpoint types and helper used by the nurse card for "ready since" status
export interface ReadySincePrediction {
  prediction: 'ready' | 'not_ready'
  timestamp: string
}

export async function getMLPrediction(patientId: string): Promise<ReadySincePrediction | null> {
  try {
    const res = await fetch(`/api/predict/${patientId}`)
    if (!res.ok) return null
    const data = await res.json()
    return { prediction: data.prediction, timestamp: data.timestamp }
  } catch {
    return null
  }
}