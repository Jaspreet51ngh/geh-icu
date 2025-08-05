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
  // Add any missing vitals your model needs
  meanBP?: number
  centralVenousPressure?: number
}

export interface LabValues {
  lactate: number
  creatinine?: number
  bilirubin?: number
  // Add any missing lab values your model needs
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
  // Add any additional attributes your model needs
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

export interface MLPrediction {
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
  doctor_id?: string
  department_admin_id?: string
  status: "pending" | "doctor_approved" | "admin_approved" | "rejected"
  target_department?: string
  notes?: string
  created_at: string
  updated_at: string
}

export class MLPredictionService {
  private static readonly API_BASE_URL = "http://localhost:8000"
  private static ws: WebSocket | null = null
  private static listeners: Map<string, Function[]> = new Map()

  // WebSocket connection for real-time updates
  static connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    this.ws = new WebSocket(`${this.API_BASE_URL.replace('http', 'ws')}/ws`)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected for real-time updates')
    }
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.notifyListeners(data.type, data.data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected, attempting to reconnect...')
      setTimeout(() => this.connectWebSocket(), 5000)
    }
  }

  // Event listener system
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
      callbacks.forEach(callback => callback(data))
    }
  }

  // API call to your FastAPI backend
  static async callMLAPI(patient: Patient): Promise<MLPrediction> {
    try {
      // Map to your model's exact attributes
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
        headers: {
          "Content-Type": "application/json",
        },
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

  // Get all patients with predictions
  static async getAllPatients(): Promise<Patient[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/patients`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Failed to fetch patients:", error)
      return []
    }
  }

  // Get real-time vitals for a specific patient
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

  // Transfer request management
  static async createTransferRequest(request: Omit<TransferRequest, 'id'>): Promise<TransferRequest> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transfer-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const result = await response.json()
      return { ...request, id: result.id }
    } catch (error) {
      console.error("Failed to create transfer request:", error)
      throw error
    }
  }

  static async getTransferRequests(): Promise<TransferRequest[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transfer-requests`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Failed to fetch transfer requests:", error)
      return []
    }
  }

  static async updateTransferRequest(requestId: string, updateData: Partial<TransferRequest>): Promise<TransferRequest> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transfer-request/${requestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to update transfer request:", error)
      throw error
    }
  }

  static async predictTransferReadiness(patient: Patient): Promise<MLPrediction> {
    // Try your ML API first
    try {
      return await this.callMLAPI(patient)
    } catch (error) {
      // Fallback to rule-based prediction if API fails
      return this.fallbackPrediction(patient)
    }
  }

  // Calculate SOFA score components
  private static calculateSOFAScore(patient: Patient): number {
    let sofa = 0

    // Respiratory (PaO2/FiO2 ratio approximation using SpO2)
    if (patient.vitals.spO2 < 90) sofa += 3
    else if (patient.vitals.spO2 < 95) sofa += 2
    else if (patient.vitals.spO2 < 98) sofa += 1

    // Cardiovascular (MAP and vasopressors)
    const map = (patient.vitals.systolicBP + 2 * (patient.vitals.diastolicBP || 60)) / 3
    if (patient.onPressors) sofa += 4
    else if (map < 70) sofa += 1

    // Hepatic (bilirubin)
    if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 12) sofa += 4
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 6) sofa += 3
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 2) sofa += 2
    else if (patient.labValues?.bilirubin && patient.labValues.bilirubin >= 1.2) sofa += 1

    // Renal (creatinine)
    if (patient.labValues?.creatinine && patient.labValues.creatinine >= 5) sofa += 4
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 3.5) sofa += 3
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 2) sofa += 2
    else if (patient.labValues?.creatinine && patient.labValues.creatinine >= 1.2) sofa += 1

    // Neurological (GCS)
    if (patient.vitals.gcs < 6) sofa += 4
    else if (patient.vitals.gcs < 10) sofa += 3
    else if (patient.vitals.gcs < 13) sofa += 2
    else if (patient.vitals.gcs < 15) sofa += 1

    return sofa
  }

  // Calculate comorbidity score
  private static calculateComorbidityScore(comorbidities: string[]): number {
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

  // Rename the existing function to fallback
  private static fallbackPrediction(patient: Patient): MLPrediction {
    try {
      // Calculate risk scores
      const sofaScore = this.calculateSOFAScore(patient)
      const comorbidityScore = this.calculateComorbidityScore(patient.comorbidities)

      // Vital signs stability assessment
      const vitalStability = this.assessVitalStability(patient.vitals)

      // Risk factors identification
      const riskFactors = this.identifyRiskFactors(patient)

      // Overall assessment
      let transferReady = true
      let confidence = 0.8
      let reasoning = ""

      // Critical exclusion criteria
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
        // Patient appears stable for transfer
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

  // Assess vital signs stability
  private static assessVitalStability(vitals: PatientVitals): number {
    let stability = 1.0

    // Heart rate assessment
    if (vitals.heartRate < 60 || vitals.heartRate > 120) stability -= 0.2
    else if (vitals.heartRate < 50 || vitals.heartRate > 140) stability -= 0.4

    // SpO2 assessment
    if (vitals.spO2 < 95) stability -= 0.3
    else if (vitals.spO2 < 92) stability -= 0.5

    // Blood pressure assessment
    const map = (vitals.systolicBP + 2 * (vitals.diastolicBP || 60)) / 3
    if (map < 65 || vitals.systolicBP > 180) stability -= 0.3

    // Temperature assessment
    if (vitals.temperature && (vitals.temperature > 101.5 || vitals.temperature < 96)) stability -= 0.2

    // Respiratory rate assessment
    if (vitals.respiratoryRate > 24 || vitals.respiratoryRate < 12) stability -= 0.2

    return Math.max(0, stability)
  }

  // Identify risk factors
  private static identifyRiskFactors(patient: Patient): string[] {
    const factors: string[] = []

    if (patient.onVentilator) factors.push("Mechanical ventilation")
    if (patient.onPressors) factors.push("Vasopressor support")
    if (patient.vitals.gcs < 15) factors.push("Altered mental status")
    if (patient.vitals.lactate > 2.0) factors.push("Elevated lactate")
    if (patient.labValues?.creatinine && patient.labValues.creatinine > 1.5) factors.push("Renal dysfunction")
    if (patient.vitals.spO2 < 95) factors.push("Hypoxemia")
    if (patient.age > 70) factors.push("Advanced age")
    if (patient.comorbidities.length > 2) factors.push("Multiple comorbidities")

    return factors.length > 0 ? factors : ["Low risk profile"]
  }
}
