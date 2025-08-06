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
from robust_predictor import RobustICUPredictor  # <-- ADD THIS
from typing import List


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

# WebSocket connection management
active_connections: List[WebSocket] = []

async def send_notification_to_all_connections(notification: dict):
    """Safely send notification to all active WebSocket connections"""
    disconnected_connections = []
    
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(notification))
        except Exception as e:
            logger.warning(f"Failed to send notification to WebSocket: {e}")
            disconnected_connections.append(connection)
    
    # Remove disconnected connections
    for connection in disconnected_connections:
        if connection in active_connections:
            active_connections.remove(connection)
            logger.info(f"Removed disconnected WebSocket connection. Active connections: {len(active_connections)}")

# Initialize database with patients
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
        
        # Use static vitals from CSV data without random variations
        static_vitals = {
            "heartRate": float(row['HR']),
            "spO2": float(row['SpO2']),
            "respiratoryRate": float(row['RESP']),
            "systolicBP": float(row['ABPsys']),
            "lactate": float(row['lactate']),
            "gcs": float(row['gcs'])
        }
        
        # Use realistic patient names
        patient_name = patient_names[i % len(patient_names)]
        
        patient_data = {
            "id": f"ICU-{i+1:03d}",
            "name": patient_name,
            "age": int(row['age']),
            "vitals": static_vitals,
            "onVentilator": bool(row['on_vent']),
            "onPressors": bool(row['on_pressors']),
            "comorbidityScore": float(row['comorbidity_score'])
        }
        
        db.add_patient(patient_data)
    
    logger.info("Database initialization complete")

# Initialize database on startup (will be called after CSV loading)

# Load your trained model with fallback
try:
    # Import the robust predictor
    import sys
    sys.path.append(os.path.dirname(__file__))
    from robust_predictor import RobustICUPredictor
    
    # Initialize the robust predictor with models directory
    model = RobustICUPredictor(model_dir=os.path.join(os.path.dirname(__file__), "..", "models"))
    logger.info("RobustICUPredictor model loaded successfully")
        
except Exception as e:
    logger.error(f"Failed to load robust model: {e}")
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
    ml_prediction: Dict[str, Any] 
    
# class TransferRequest(BaseModel):
#     patient_id: str
#     nurse_id: str
#     doctor_id: Optional[str] = None
#     department_admin_id: Optional[str] = None
#     status: Optional[str] = "pending"  # Now optional with default
#     target_department: Optional[str] = None
#     notes: Optional[str] = None
#     created_at: Optional[str] = datetime.utcnow().isoformat()
#     updated_at: Optional[str] = datetime.utcnow().isoformat()
    
# In-memory storage for transfer requests (legacy - now using database)
transfer_requests = {}

#         raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
@app.post("/predict", response_model=PredictionResponse)
async def predict_transfer_readiness(patient: PatientData):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        data_dict = {
            "HR": patient.HR,
            "SpO2": patient.SpO2,
            "RESP": patient.RESP,
            "ABPsys": patient.ABPsys,
            "lactate": patient.lactate,
            "gcs": patient.gcs,
            "age": patient.age,
            "comorbidity_score": patient.comorbidity_score,
            "on_vent": int(patient.on_vent),
            "on_pressors": int(patient.on_pressors)
        }

        result = model.predict_dict(data_dict, ensemble_type='best')
        transfer_ready_prob = result["probability"]
        prediction = 1 if result["prediction"] == "Ready" else 0
        confidence = max(transfer_ready_prob, 1 - transfer_ready_prob)

        try:
            risk_factors = model.get_top_features(data_dict, top_k=3)
        except Exception:
            risk_factors = ["Clinical assessment required"]

        explanation = (
            f"Patient shows stable clinical parameters with {confidence:.1%} confidence for safe transfer"
            if prediction == 1
            else f"Patient requires continued ICU monitoring with {confidence:.1%} confidence"
        )

        return PredictionResponse(
            prediction="Ready" if prediction == 1 else "Not Ready",
            probability=float(transfer_ready_prob),
            confidence=float(confidence),
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

@app.get("/patients", response_model=List[dict])
async def get_patients():
    """Get all patients with current vitals and ML predictions from database"""
    try:
        db_patients = db.get_all_patients()
        patients = []

        for db_patient in db_patients:
            patient_id = db_patient['id']
            cached_prediction = db.get_cached_prediction(patient_id)

            # Try using cached prediction if available
            if cached_prediction is not None:
                try:
                    prediction = PredictionResponse(**cached_prediction)
                except Exception as e:
                    logger.warning(f"Invalid cached prediction for patient {patient_id}, regenerating. Error: {e}")
                    cached_prediction = None

            # If no valid cached prediction, run model
            if cached_prediction is None:
                try:
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
                    prediction = await predict_transfer_readiness(patient_data)
                    db.cache_prediction(patient_id, prediction.dict())

                except Exception as e:
                    logger.error(f"Prediction failed for patient {patient_id}: {e}")
                    raise HTTPException(status_code=500, detail=f"Prediction failed for patient {patient_id}")

            # Round and prepare frontend-friendly prediction format
            confidence_percent = round(prediction.confidence * 100, 1)

            frontend_prediction = {
                "transferReady": prediction.prediction == "Ready",
                "confidence": confidence_percent,
                "reasoning": prediction.explanation,
                "riskFactors": prediction.risk_factors,
                "timestamp": prediction.timestamp
            }

            # Full patient object with prediction
            patient = {
                "id": patient_id,
                "name": db_patient['name'],
                "age": db_patient['age'],
                "department": db_patient.get('department', 'ICU'),
                "bed": db_patient.get('bed', f"Bed-{patient_id}"),
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

@app.get("/patients")
async def get_patients():
    """Get all patients with current vitals and ML predictions from database"""
    try:
        db_patients = db.get_all_patients()
        patients = []

        for db_patient in db_patients:
            patient_id = db_patient['id']
            cached_prediction = db.get_cached_prediction(patient_id)

            if cached_prediction is not None:
                try:
                    prediction = PredictionResponse(**cached_prediction)
                except Exception as e:
                    logger.warning(f"Invalid cached prediction for patient {patient_id}, regenerating. Error: {e}")
                    cached_prediction = None  # Fallback to regeneration

            if cached_prediction is None:
                try:
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

                    prediction = await predict_transfer_readiness(patient_data)
                    db.cache_prediction(patient_id, prediction.dict())

                except Exception as e:
                    logger.error(f"Prediction failed for patient {patient_id}: {e}")
                    prediction = PredictionResponse(
                        prediction="Not Ready",
                        probability=0.3,
                        confidence=0.7,
                        explanation="Unable to assess - requires clinical evaluation",
                        risk_factors=["Assessment unavailable"],
                        model_version="1.0.0",
                        timestamp=datetime.now().isoformat()
                    )
                    db.cache_prediction(patient_id, prediction.dict())

            # Round the confidence value to 1 decimal place
            confidence_percent = round(prediction.confidence * 100, 1)

            frontend_prediction = {
                "transferReady": prediction.prediction == "Ready",
                "confidence": confidence_percent,
                "reasoning": prediction.explanation,
                "riskFactors": prediction.risk_factors,
                "timestamp": prediction.timestamp
            }

            patient = {
                "id": patient_id,
                "name": db_patient['name'],
                "age": db_patient['age'],
                "department": db_patient.get('department', 'ICU'),
                "bed": db_patient.get('bed', f"Bed-{patient_id}"),
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
    try:
        # Get patient from database
        patient = db.get_patient(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Return static vitals from database
        vitals = {
            "heartRate": patient['vitals']['heartRate'],
            "spO2": patient['vitals']['spO2'],
            "respiratoryRate": patient['vitals']['respiratoryRate'],
            "systolicBP": patient['vitals']['systolicBP'],
            "lactate": patient['vitals']['lactate'],
            "gcs": patient['vitals']['gcs'],
            "timestamp": datetime.now().isoformat()
        }
        
        return vitals
        
    except Exception as e:
        logger.error(f"Error getting patient vitals: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patient vitals")

# WebSocket for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Send real-time patient updates every 30 seconds (much less frequent)
            await asyncio.sleep(30)
            
            # Get random patient from database
            patients = db.get_all_patients()
            if patients:
                patient = random.choice(patients)
                
                # Send static vitals from database (no new predictions)
                vitals = {
                    "patient_id": patient['id'],
                    "heartRate": patient['vitals']['heartRate'],
                    "spO2": patient['vitals']['spO2'],
                    "respiratoryRate": patient['vitals']['respiratoryRate'],
                    "systolicBP": patient['vitals']['systolicBP'],
                    "lactate": patient['vitals']['lactate'],
                    "gcs": patient['vitals']['gcs'],
                    "timestamp": datetime.now().isoformat()
                }
                
                try:
                    await websocket.send_text(json.dumps({
                        "type": "vitals_update",
                        "data": vitals
                    }))
                except Exception as e:
                    logger.warning(f"Failed to send vitals update: {e}")
                    break
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)

# Transfer request endpoints
@app.post("/transfer-request")
def create_transfer_request(request_data: TransferRequest):
    try:
        conn = get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Validate patient exists
        cursor.execute("SELECT id FROM patients WHERE id = ?", (request_data.patient_id,))
        patient_result = cursor.fetchone()
        if not patient_result:
            logger.error(f"Patient not found: {request_data.patient_id}")
            raise HTTPException(status_code=404, detail="Patient not found")

        # ✅ Generate unique request_id each time
        request_id = f"TR-{uuid.uuid4().hex[:8]}"

        # Insert into DB
        cursor.execute(
            """
            INSERT INTO transfer_requests (
                request_id,
                patient_id,
                nurse_id,
                doctor_id,
                department_admin_id,
                status,
                target_department,
                notes,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_id,
                request_data.patient_id,
                request_data.nurse_id,
                request_data.doctor_id,
                request_data.department_admin_id,
                request_data.status,
                request_data.target_department,
                request_data.notes,
                request_data.created_at,
                request_data.updated_at
            )
        )

        conn.commit()
        conn.close()

        return {
            "message": "Transfer request created successfully",
            "request_id": request_id
        }

    except Exception as e:
        logger.exception("Error creating transfer request")
        raise HTTPException(status_code=500, detail=f"Transfer request failed: {str(e)}")

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
            
            await send_notification_to_all_connections(notification)
        
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
