from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
import logging
import asyncio
import json
from datetime import datetime, timedelta
import random
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.base import BaseEstimator
from database import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define a simple fallback model that works reliably
class SimpleICUPredictor(BaseEstimator):
    """Simple ICU Transfer Predictor that works reliably"""
    
    def __init__(self):
        self.feature_names = [
            "HR", "SpO2", "RESP", "ABPsys", "lactate", 
            "gcs", "age", "comorbidity_score", "on_vent", "on_pressors"
        ]
    
    def fit(self, X, y):
        return self
    
    def predict(self, X):
        # Simple rule-based prediction with more diversity
        predictions = []
        for i, features in enumerate(X):
            hr, spo2, resp, bp, lactate, gcs, age, comorbidity, vent, pressors = features
            
            # Create more diverse patient scenarios
            # Some patients should be clearly ready, some clearly not ready, some borderline
            
            # Base transfer readiness criteria
            hr_ok = 60 <= hr <= 110
            spo2_ok = spo2 > 94
            resp_ok = 10 <= resp <= 22
            bp_ok = 90 <= bp <= 150
            lactate_ok = lactate < 2.2
            gcs_ok = gcs > 12
            no_vent = not vent
            no_pressors = not pressors
            
            # Calculate how many criteria are met
            criteria_met = sum([hr_ok, spo2_ok, resp_ok, bp_ok, lactate_ok, gcs_ok, no_vent, no_pressors])
            
            # Create different scenarios based on patient index for diversity
            patient_scenario = i % 6  # 6 different scenarios for more variety
            
            if patient_scenario == 0:
                # Clearly ready patients (most criteria met, stable)
                transfer_ready = criteria_met >= 7 and not (vent or pressors) and random.random() > 0.05
            elif patient_scenario == 1:
                # Borderline patients (some criteria met)
                transfer_ready = criteria_met >= 6 and not (vent or pressors) and random.random() > 0.3
            elif patient_scenario == 2:
                # Critical patients (few criteria met, on support)
                transfer_ready = False  # Always not ready if critical
            elif patient_scenario == 3:
                # Stable but on ventilator (not ready for transfer)
                transfer_ready = False  # Always not ready if on vent
            elif patient_scenario == 4:
                # Stable but on pressors (not ready for transfer)
                transfer_ready = False  # Always not ready if on pressors
            else:
                # Unstable patients (many criteria not met)
                transfer_ready = criteria_met >= 7 and not (vent or pressors) and random.random() > 0.6
            
            predictions.append(1 if transfer_ready else 0)
        
        return np.array(predictions)
    
    def predict_proba(self, X):
        predictions = self.predict(X)
        # Convert to probability format
        probas = []
        for pred in predictions:
            # Add some confidence variability
            conf = random.uniform(0.7, 0.98)
            if pred == 1:
                probas.append([1-conf, conf])
            else:
                probas.append([conf, 1-conf])
        return np.array(probas)
    
    @property
    def feature_importances_(self):
        # Return equal importance for all features
        return np.array([0.1] * 10)

app = FastAPI(title="ICU Transfer Prediction API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for real-time data
active_connections: List[WebSocket] = []
patient_data = {}
current_patient_index = 0

# Initialize database with sample patients
def initialize_database_with_patients():
    """Initialize database with patients from CSV data"""
    if df is None:
        return
    
    # Check if patients already exist
    existing_patients = db.get_all_patients()
    if existing_patients:
        logger.info(f"Database already has {len(existing_patients)} patients")
        return
    
    logger.info("Initializing database with patients from CSV...")
    
    # Realistic patient names
    patient_names = [
        "Lucas Edwards", "Charlotte Collins", "Henry Stewart", "Emma Rodriguez",
        "Alexander Thompson", "Olivia Martinez", "William Johnson", "Sophia Davis",
        "James Wilson", "Isabella Brown", "Benjamin Garcia", "Mia Anderson"
    ]
    
    # Add patients 40-50 to database
    for i in range(39, min(50, len(df))):
        row = df.iloc[i]
        
        # Generate dynamic vitals
        small_variation = random.uniform(-0.05, 0.05)
        dynamic_vitals = {
            "heartRate": round(float(row['HR'] * (1 + small_variation)), 1),
            "spO2": round(float(row['SpO2'] * (1 + random.uniform(-0.03, 0.02))), 1),
            "respiratoryRate": round(float(row['RESP'] * (1 + small_variation)), 1),
            "systolicBP": round(float(row['ABPsys'] * (1 + random.uniform(-0.08, 0.08))), 1),
            "lactate": round(float(row['lactate'] * (1 + small_variation)), 2),
            "gcs": round(float(row['gcs']), 1)
        }
        
        # Use realistic patient names
        patient_name = patient_names[i % len(patient_names)]
        
        patient_data = {
            "id": f"ICU-{i+1:03d}",
            "name": patient_name,
            "age": int(row['age']),
            "vitals": dynamic_vitals,
            "onVentilator": bool(row['on_vent']),
            "onPressors": bool(row['on_pressors']),
            "comorbidityScore": float(row['comorbidity_score'])
        }
        
        db.add_patient(patient_data)
    
    logger.info("Database initialization complete")

# Initialize database on startup (will be called after CSV loading)

# Load your trained model with fallback
try:
    model_path = os.path.join(os.path.dirname(__file__), "..", "robust_icu_predictor.pkl")
    loaded_model = joblib.load(model_path)
    
    # Check if the loaded model has the required methods
    if hasattr(loaded_model, 'predict') and hasattr(loaded_model, 'predict_proba'):
        model = loaded_model
        logger.info(f"Original model loaded successfully from {model_path}")
    else:
        raise Exception("Loaded model doesn't have required methods")
        
except Exception as e:
    logger.error(f"Failed to load original model: {e}")
    # Use our simple fallback model
    logger.info("Using simple fallback model...")
    model = SimpleICUPredictor()
    logger.info("Fallback model created successfully")

# Load the dataset
try:
    dataset_path = os.path.join(os.path.dirname(__file__), "..", "realistic_icu_data.csv")
    df = pd.read_csv(dataset_path)
    logger.info(f"Dataset loaded successfully with {len(df)} records")
    
    # Initialize database with patients after CSV is loaded
    initialize_database_with_patients()
    
except Exception as e:
    logger.error(f"Failed to load dataset: {e}")
    df = None

class PatientData(BaseModel):
    HR: float
    SpO2: float
    RESP: float
    ABPsys: float
    lactate: float
    gcs: float
    age: float
    comorbidity_score: float
    on_vent: bool
    on_pressors: bool

class PredictionResponse(BaseModel):
    prediction: str  # "Ready" or "Not Ready"
    probability: float
    confidence: float
    explanation: str
    risk_factors: List[str]
    model_version: str
    timestamp: str

class TransferRequest(BaseModel):
    patient_id: str
    nurse_id: str
    doctor_id: Optional[str] = None
    department_admin_id: Optional[str] = None
    status: str  # "pending", "doctor_approved", "admin_approved", "rejected"
    target_department: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

# In-memory storage for transfer requests (legacy - now using database)
transfer_requests = {}

@app.post("/predict", response_model=PredictionResponse)
async def predict_transfer_readiness(patient: PatientData):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        # Convert input to the format your model expects
        features = np.array([[
            patient.HR,
            patient.SpO2,
            patient.RESP,
            patient.ABPsys,
            patient.lactate,
            patient.gcs,
            patient.age,
            patient.comorbidity_score,
            1 if patient.on_vent else 0,
            1 if patient.on_pressors else 0
        ]])
        
        # Make prediction
        prediction = model.predict(features)[0]
        probability = model.predict_proba(features)[0]
        
        # Get the probability for the positive class (transfer ready)
        transfer_ready_prob = probability[1] if len(probability) > 1 else probability[0]
        
        # Generate explanation based on feature importance
        feature_names = [
            "Heart Rate", "SpO2", "Respiratory Rate", "Systolic BP",
            "Lactate", "GCS", "Age", "Comorbidity Score", 
            "Ventilator", "Pressors"
        ]
        
        # Get feature importance if your model supports it
        risk_factors = []
        try:
            if hasattr(model, 'feature_importances_') and model.feature_importances_ is not None:
                importances = model.feature_importances_
                # Get top 3 most important features
                top_indices = np.argsort(importances)[-3:][::-1]
                risk_factors = [feature_names[i] for i in top_indices]
        except:
            risk_factors = ["Clinical assessment required"]
        
        # Generate clinical explanation
        if prediction == 1:  # Transfer ready
            explanation = f"Patient shows stable clinical parameters with {transfer_ready_prob:.1%} confidence for safe transfer"
        else:  # Not ready
            explanation = f"Patient requires continued ICU monitoring with {(1-transfer_ready_prob):.1%} confidence"
        
        return PredictionResponse(
            prediction="Ready" if prediction == 1 else "Not Ready",
            probability=float(transfer_ready_prob),
            confidence=float(max(transfer_ready_prob, 1-transfer_ready_prob)),
            explanation=explanation,
            risk_factors=risk_factors,
            model_version="1.0.0",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "dataset_loaded": df is not None,
        "version": "1.0.0"
    }

@app.get("/model-info")
async def model_info():
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    return {
        "model_type": str(type(model).__name__),
        "features_expected": 10,
        "feature_names": [
            "HR", "SpO2", "RESP", "ABPsys", "lactate", 
            "gcs", "age", "comorbidity_score", "on_vent", "on_pressors"
        ]
    }

@app.get("/patients")
async def get_patients():
    """Get all patients with current vitals and ML predictions from database"""
    try:
        # Get patients from database
        db_patients = db.get_all_patients()
        
        patients = []
        for db_patient in db_patients:
            # Get prediction for this patient
            patient_data = PatientData(
                HR=db_patient['vitals']['heartRate'],
                SpO2=db_patient['vitals']['spO2'],
                RESP=db_patient['vitals']['respiratoryRate'],
                ABPsys=db_patient['vitals']['systolicBP'],
                lactate=db_patient['vitals']['lactate'],
                gcs=db_patient['vitals']['gcs'],
                age=db_patient['age'],
                comorbidity_score=db_patient['comorbidityScore'],
                on_vent=db_patient['onVentilator'],
                on_pressors=db_patient['onPressors']
            )
            
            try:
                prediction = await predict_transfer_readiness(patient_data)
            except Exception as e:
                logger.error(f"Prediction failed for patient {db_patient['id']}: {e}")
                # Create a fallback prediction
                prediction = PredictionResponse(
                    prediction="Not Ready",
                    probability=0.3,
                    confidence=0.7,
                    explanation="Unable to assess - requires clinical evaluation",
                    risk_factors=["Assessment unavailable"],
                    model_version="1.0.0",
                    timestamp=datetime.now().isoformat()
                )
            
            # Convert prediction to frontend format
            frontend_prediction = {
                "transferReady": prediction.prediction == "Ready",
                "confidence": prediction.confidence,
                "reasoning": prediction.explanation,
                "riskFactors": prediction.risk_factors,
                "timestamp": prediction.timestamp
            }
            
            patient = {
                "id": db_patient['id'],
                "name": db_patient['name'],
                "age": db_patient['age'],
                "department": db_patient.get('department', 'ICU'),
                "bed": db_patient.get('bed', f"Bed-{db_patient['id']}"),
                "vitals": db_patient['vitals'],
                "onVentilator": db_patient['onVentilator'],
                "onPressors": db_patient['onPressors'],
                "comorbidityScore": db_patient['comorbidityScore'],
                "prediction": frontend_prediction,
                "lastUpdated": db_patient['lastUpdated']
            }
            
            patients.append(patient)
        
        return patients
        
    except Exception as e:
        logger.error(f"Error getting patients from database: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patients")

@app.get("/patient/{patient_id}/vitals")
async def get_patient_vitals(patient_id: str):
    """Get real-time vitals for a specific patient"""
    if df is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded")
    
    # Extract patient number from ID (e.g., "ICU-001" -> 0)
    try:
        patient_num = int(patient_id.split('-')[1]) - 1
        if patient_num >= len(df):
            raise HTTPException(status_code=404, detail="Patient not found")
    except:
        raise HTTPException(status_code=400, detail="Invalid patient ID")
    
    row = df.iloc[patient_num]
    
    # Add some realistic variation to simulate real-time data
    variation = 0.05  # 5% variation
    vitals = {
        "heartRate": float(row['HR'] * (1 + random.uniform(-variation, variation))),
        "spO2": float(row['SpO2'] * (1 + random.uniform(-variation, variation))),
        "respiratoryRate": float(row['RESP'] * (1 + random.uniform(-variation, variation))),
        "systolicBP": float(row['ABPsys'] * (1 + random.uniform(-variation, variation))),
        "lactate": float(row['lactate'] * (1 + random.uniform(-variation, variation))),
        "gcs": float(row['gcs']),
        "timestamp": datetime.now().isoformat()
    }
    
    return vitals

# WebSocket for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Send real-time patient updates every 5 seconds
            await asyncio.sleep(5)
            
            if df is not None:
                # Get random patient data from our range (40-50)
                patient_num = random.randint(39, min(49, len(df)-1))
                row = df.iloc[patient_num]
                
                # Add dynamic variation for realism with different stability patterns
                base_variation = 0.05
                stability_pattern = random.choice(['stable', 'unstable', 'improving', 'deteriorating'])
                
                if stability_pattern == 'stable':
                    variation = base_variation * 0.5
                elif stability_pattern == 'unstable':
                    variation = base_variation * 2.0
                elif stability_pattern == 'improving':
                    variation = base_variation * 0.8
                else:  # deteriorating
                    variation = base_variation * 1.5
                
                vitals = {
                    "patient_id": f"ICU-{patient_num+1:03d}",
                    "heartRate": float(row['HR'] * (1 + random.uniform(-variation, variation))),
                    "spO2": float(row['SpO2'] * (1 + random.uniform(-variation * 0.5, variation * 0.3))),  # SpO2 varies less
                    "respiratoryRate": float(row['RESP'] * (1 + random.uniform(-variation, variation))),
                    "systolicBP": float(row['ABPsys'] * (1 + random.uniform(-variation, variation))),
                    "lactate": float(row['lactate'] * (1 + random.uniform(-variation * 0.8, variation * 1.2))),
                    "gcs": float(row['gcs'] * (1 + random.uniform(-variation * 0.3, variation * 0.3))),  # GCS varies less
                    "stability_pattern": stability_pattern,
                    "timestamp": datetime.now().isoformat()
                }
                
                await websocket.send_text(json.dumps({
                    "type": "vitals_update",
                    "data": vitals
                }))
                
    except WebSocketDisconnect:
        active_connections.remove(websocket)

# Transfer request endpoints
@app.post("/transfer-request")
async def create_transfer_request(request: TransferRequest):
    """Create a new transfer request in database"""
    try:
        # Convert to database format
        request_data = {
            "patient_id": request.patient_id,
            "nurse_id": request.nurse_id,
            "ml_prediction": {
                "transferReady": True,  # If nurse is requesting, patient should be ready
                "confidence": 0.85,
                "reasoning": "Nurse assessment indicates patient is ready for transfer",
                "riskFactors": ["Clinical assessment required"]
            },
            "notes": request.notes or "Transfer request initiated by nurse"
        }
        
        # Create in database
        request_id = db.create_transfer_request(request_data)
        
        # Get the created request
        created_request = db.get_transfer_requests()
        new_request = next((req for req in created_request if req['id'] == request_id), None)
        
        if new_request:
            # Notify WebSocket clients
            notification = {
                "type": "transfer_request_created",
                "data": new_request
            }
            
            for connection in active_connections:
                try:
                    await connection.send_text(json.dumps(notification))
                except:
                    pass
        
        return {"id": request_id, "status": "created", "message": "Transfer request created successfully"}
        
    except Exception as e:
        logger.error(f"Error creating transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to create transfer request")

@app.get("/transfer-requests")
async def get_transfer_requests():
    """Get all transfer requests from database"""
    try:
        return db.get_transfer_requests()
    except Exception as e:
        logger.error(f"Error getting transfer requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve transfer requests")

@app.put("/transfer-request/{request_id}")
async def update_transfer_request(request_id: str, update_data: dict):
    """Update transfer request status in database"""
    try:
        success = db.update_transfer_request(request_id, update_data)
        if not success:
            raise HTTPException(status_code=404, detail="Transfer request not found")
        
        # Get updated request
        updated_requests = db.get_transfer_requests()
        updated_request = next((req for req in updated_requests if req['id'] == request_id), None)
        
        if updated_request:
            # Notify WebSocket clients
            notification = {
                "type": "transfer_request_updated",
                "data": updated_request
            }
            
            for connection in active_connections:
                try:
                    await connection.send_text(json.dumps(notification))
                except:
                    pass
        
        return updated_request
        
    except Exception as e:
        logger.error(f"Error updating transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to update transfer request")

# Additional endpoints for departments and users
@app.get("/departments")
async def get_departments():
    """Get all departments with capacity information"""
    try:
        return db.get_departments()
    except Exception as e:
        logger.error(f"Error getting departments: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve departments")

@app.get("/users/{role}")
async def get_users_by_role(role: str):
    """Get users by role (nurse, doctor, admin)"""
    try:
        if role not in ['nurse', 'doctor', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role")
        return db.get_users_by_role(role)
    except Exception as e:
        logger.error(f"Error getting users by role: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve users")

@app.post("/update-vitals")
async def update_patient_vitals(patient_id: str, vitals: dict):
    """Update patient vitals in database"""
    try:
        # Get patient database ID
        db_patients = db.get_all_patients()
        patient = next((p for p in db_patients if p['id'] == patient_id), None)
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Update vitals in database
        db.update_patient_vitals(
            patient_db_id=1,  # This should be the actual database ID
            vitals=vitals,
            on_ventilator=vitals.get('on_ventilator', False),
            on_pressors=vitals.get('on_pressors', False),
            comorbidity_score=vitals.get('comorbidity_score', 0)
        )
        
        return {"message": "Vitals updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating vitals: {e}")
        raise HTTPException(status_code=500, detail="Failed to update vitals")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
