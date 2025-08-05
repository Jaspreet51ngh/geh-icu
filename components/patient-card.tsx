"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Heart,
  Thermometer,
  Activity,
  Bed,
  Clock,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  User,
  Send,
} from "lucide-react"
import { VitalsChart } from "./vitals-chart"
import { type Patient } from "@/lib/ml-service"

interface PatientCardProps {
  patient: Patient
  onTransferRequest: (patient: Patient) => void
}

export function PatientCard({ patient, onTransferRequest }: PatientCardProps) {
  const getStatusColor = (prediction: any) => {
    if (!prediction) return "bg-slate-100 text-slate-800"
    
    if (prediction.transferReady) {
      return "bg-green-100 text-green-800"
    } else if (prediction.confidence < 0.3) {
      return "bg-red-100 text-red-800"
    } else {
      return "bg-yellow-100 text-yellow-800"
    }
  }

  const getStatusText = (prediction: any) => {
    if (!prediction) return "Unknown"
    
    if (prediction.transferReady) {
      return "Transfer Ready"
    } else if (prediction.confidence < 0.3) {
      return "Critical"
    } else {
      return "Monitoring"
    }
  }

  const getStatusIcon = (prediction: any) => {
    if (!prediction) return <Activity className="h-4 w-4" />
    
    if (prediction.transferReady) {
      return <CheckCircle2 className="h-4 w-4" />
    } else if (prediction.confidence < 0.3) {
      return <AlertTriangle className="h-4 w-4" />
    } else {
      return <TrendingUp className="h-4 w-4" />
    }
  }

  const getVitalStatus = (vital: string, value: number) => {
    switch (vital) {
      case "heartRate":
        if (value < 60 || value > 120) return "border-red-300 bg-red-50"
        if (value < 70 || value > 110) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      case "spO2":
        if (value < 92) return "border-red-300 bg-red-50"
        if (value < 95) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      case "respiratoryRate":
        if (value > 24 || value < 12) return "border-red-300 bg-red-50"
        if (value > 20 || value < 14) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      case "systolicBP":
        if (value < 90 || value > 180) return "border-red-300 bg-red-50"
        if (value < 100 || value > 160) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      case "lactate":
        if (value > 4.0) return "border-red-300 bg-red-50"
        if (value > 2.0) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      case "gcs":
        if (value < 9) return "border-red-300 bg-red-50"
        if (value < 13) return "border-amber-300 bg-amber-50"
        return "border-green-300 bg-green-50"
      default:
        return "border-slate-300 bg-slate-50"
    }
  }

  const cardClasses = `professional-card transition-all duration-500 hover:shadow-2xl ${
    patient.prediction?.transferReady 
      ? "border-green-200 hover:border-green-300" 
      : patient.prediction?.confidence < 0.3
      ? "border-red-200 hover:border-red-300"
      : "border-amber-200 hover:border-amber-300"
  }`

  const lastUpdated = patient.lastUpdated 
    ? new Date(patient.lastUpdated).toLocaleTimeString()
    : "Unknown"

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                {patient.name}
              </CardTitle>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <span>ID: {patient.id}</span>
                <span>•</span>
                <span>{patient.age} years</span>
              </div>
            </div>
          </div>
          <Badge className={getStatusColor(patient.prediction)}>
            <div className="flex items-center space-x-1">
              {getStatusIcon(patient.prediction)}
              <span>{getStatusText(patient.prediction)}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ML Prediction Section */}
        {patient.prediction && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <Brain className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800">AI Prediction</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Transfer Ready:</span>
                <Badge variant={patient.prediction.transferReady ? "default" : "secondary"}>
                  {patient.prediction.transferReady ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Confidence:</span>
                <span className="text-sm font-medium text-blue-800">
                  {(patient.prediction.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-sm text-blue-700 mt-2">
                <strong>Reasoning:</strong> {patient.prediction.reasoning}
              </div>
              {patient.prediction.riskFactors && patient.prediction.riskFactors.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm text-blue-700 font-medium">Risk Factors:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.prediction.riskFactors.slice(0, 3).map((factor, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vitals Section */}
        <div>
          <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Vital Signs</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg border ${getVitalStatus("heartRate", patient.vitals.heartRate)}`}>
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Heart Rate</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.heartRate} bpm</div>
            </div>

            <div className={`p-3 rounded-lg border ${getVitalStatus("spO2", patient.vitals.spO2)}`}>
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">SpO2</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.spO2}%</div>
            </div>

            <div className={`p-3 rounded-lg border ${getVitalStatus("respiratoryRate", patient.vitals.respiratoryRate)}`}>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Resp Rate</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.respiratoryRate} /min</div>
            </div>

            <div className={`p-3 rounded-lg border ${getVitalStatus("systolicBP", patient.vitals.systolicBP)}`}>
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Systolic BP</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.systolicBP} mmHg</div>
            </div>

            <div className={`p-3 rounded-lg border ${getVitalStatus("lactate", patient.vitals.lactate)}`}>
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Lactate</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.lactate} mmol/L</div>
            </div>

            <div className={`p-3 rounded-lg border ${getVitalStatus("gcs", patient.vitals.gcs)}`}>
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium">GCS</span>
              </div>
              <div className="text-lg font-bold">{patient.vitals.gcs}/15</div>
            </div>
          </div>
        </div>

        {/* Clinical Status */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Bed className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-700">
                Ventilator: {patient.onVentilator ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-700">
                Pressors: {patient.onPressors ? "Yes" : "No"}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span>Updated: {lastUpdated}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={() => onTransferRequest(patient)}
            disabled={!patient.prediction?.transferReady || patient.onVentilator || patient.onPressors}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4 mr-2" />
            {patient.onVentilator || patient.onPressors ? "On Life Support" : "Request Transfer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
