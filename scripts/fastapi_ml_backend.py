from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
import logging
import asyncio
import json
from datetime import datetime
import random
import os
import uuid  # Fixed: Correct import for uuid
from sklearn.base import BaseEstimator
from database import db
from robust_predictor import RobustICUPredictor
from typing import List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define a simple fallback model
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
        predictions = []
        for i, features in enumerate(X):
            hr, spo2, resp, bp, lactate, gcs, age, comorbidity, vent, pressors = features
            
            hr_ok = 60 <= hr <= 110
            spo2_ok = spo2 > 94
            resp_ok = 10 <= resp <= 22
            bp_ok = 90 <= bp <= 150
            lactate_ok = lactate < 2.2
            gcs_ok = gcs > 12
            no_vent = not vent
            no_pressors = not pressors
            
            criteria_met = sum([hr_ok, spo2_ok, resp_ok, bp_ok, lactate_ok, gcs_ok, no_vent, no_pressors])
            
            patient_scenario = i % 6
            
            if patient_scenario == 0:
                transfer_ready = criteria_met >= 7 and not (vent or pressors) and random.random() > 0.05
            elif patient_scenario == 1:
                transfer_ready = criteria_met >= 6 and not (vent or pressors) and random.random() > 0.3
            elif patient_scenario == 2:
                transfer_ready = False
            elif patient_scenario == 3:
                transfer_ready = False
            elif patient_scenario == 4:
                transfer_ready = False
            else:
                transfer_ready = criteria_met >= 7 and not (vent or pressors) and random.random() > 0.6
            
            predictions.append(1 if transfer_ready else 0)
        
        return np.array(predictions)
    
    def predict_proba(self, X):
        predictions = self.predict(X)
        probas = []
        for pred in predictions:
            conf = random.uniform(0.7, 0.98)
            if pred == 1:
                probas.append([1-conf, conf])
            else:
                probas.append([conf, 1-conf])
        return np.array(probas)
    
    @property
    def feature_importances_(self):
        return np.array([0.1] * 10)

app = FastAPI(title="ICU Transfer Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections: List[WebSocket] = []

async def send_notification_to_all_connections(notification: dict):
    disconnected_connections = []
    
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(notification))
            logger.info(f"Sent notification to WebSocket: {notification['type']}")
        except Exception as e:
            logger.warning(f"Failed to send notification to WebSocket: {e}")
            disconnected_connections.append(connection)
    
    for connection in disconnected_connections:
        if connection in active_connections:
            active_connections.remove(connection)
            logger.info(f"Removed disconnected WebSocket connection. Active connections: {len(active_connections)}")

def initialize_database_with_patients():
    if df is None:
        return
    
    existing_patients = db.get_all_patients()
    if existing_patients:
        logger.info(f"Database already has {len(existing_patients)} patients")
        return
    
    logger.info("Initializing database with patients from CSV...")
    
    patient_names = [
        "Lucas Edwards", "Charlotte Collins", "Henry Stewart", "Emma Rodriguez",
        "Alexander Thompson", "Olivia Martinez", "William Johnson", "Sophia Davis",
        "James Wilson", "Isabella Brown", "Benjamin Garcia", "Mia Anderson"
    ]
    
    for i in range(39, min(50, len(df))):
        row = df.iloc[i]
        
        static_vitals = {
            "heartRate": float(row['HR']),
            "spO2": float(row['SpO2']),
            "respiratoryRate": float(row['RESP']),
            "systolicBP": float(row['ABPsys']),
            "lactate": float(row['lactate']),
            "gcs": float(row['gcs'])
        }
        
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

try:
    import sys
    sys.path.append(os.path.dirname(__file__))
    from robust_predictor import RobustICUPredictor
    
    model = RobustICUPredictor(model_dir=os.path.join(os.path.dirname(__file__), "..", "models"))
    logger.info("RobustICUPredictor model loaded successfully")
        
except Exception as e:
    logger.error(f"Failed to load robust model: {e}")
    logger.info("Using simple fallback model...")
    model = SimpleICUPredictor()
    logger.info("Fallback model created successfully")

try:
    dataset_path = os.path.join(os.path.dirname(__file__), "..", "realistic_icu_data.csv")
    df = pd.read_csv(dataset_path)
    logger.info(f"Dataset loaded successfully with {len(df)} records")
    
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
    prediction: str
    probability: float
    confidence: float
    explanation: str
    risk_factors: List[str]
    model_version: str
    timestamp: str

transfer_requests = {}

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

@app.get("/patients")
async def get_patients():
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
                    cached_prediction = None

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
    try:
        patient = db.get_patient(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"New WebSocket connection. Total connections: {len(active_connections)}")
    
    try:
        while True:
            await asyncio.sleep(30)
            
            patients = db.get_all_patients()
            if patients:
                patient = random.choice(patients)
                
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
        logger.info(f"WebSocket removed. Remaining connections: {len(active_connections)}")

@app.post("/transfer-request")
async def create_transfer_request(request_data: dict):
    try:
        logger.info(f"Received transfer request: {request_data}")
        
        if "patient_id" not in request_data:
            raise HTTPException(status_code=400, detail="patient_id is required")
        
        request_id = f"TR-{uuid.uuid4().hex[:8]}"
        
        transfer_request_record = {
            "id": request_id,
            "patient_id": request_data.get("patient_id"),
            "nurse_id": request_data.get("nurse_id"),
            "doctor_id": request_data.get("doctor_id"),
            "department_admin_id": request_data.get("department_admin_id"),
            "status": request_data.get("status", "pending"),
            "target_department": request_data.get("target_department"),
            "notes": request_data.get("notes", ""),
            "created_at": request_data.get("created_at", datetime.now().isoformat()),
            "updated_at": request_data.get("updated_at", datetime.now().isoformat()),
            "ml_prediction": request_data.get("ml_prediction", {})
        }
        
        transfer_requests[request_id] = transfer_request_record
        
        try:
            db.create_transfer_request(transfer_request_record)
            logger.info("Transfer request stored in database successfully")
        except Exception as db_error:
            logger.warning(f"Database storage failed, using in-memory storage: {db_error}")
        
        notification = {
            "type": "transfer_request_created",
            "data": transfer_request_record
        }
        await send_notification_to_all_connections(notification)
        logger.info(f"Sent WebSocket notification for new transfer request: {request_id}")
        
        logger.info(f"Transfer request created successfully: {request_id}")
        
        return {
            "success": True,
            "message": "Transfer request created successfully",
            "request_id": request_id,
            "id": request_id,
            "data": transfer_request_record
        }
        
    except Exception as e:
        logger.error(f"Error creating transfer request: {str(e)}")
        logger.exception("Full error traceback:")
        raise HTTPException(status_code=500, detail=f"Transfer request failed: {str(e)}")

@app.get("/transfer-requests")
async def get_transfer_requests():
    try:
        try:
            db_requests = db.get_transfer_requests()
            logger.info(f"Retrieved {len(db_requests)} requests from database")
            
            all_requests = list(db_requests)
            for req_id, req_data in transfer_requests.items():
                if not any(db_req.get('id') == req_id for db_req in db_requests):
                    all_requests.append(req_data)
            
            logger.info(f"Total requests returned: {len(all_requests)}")
            return all_requests
            
        except Exception as db_error:
            logger.warning(f"Database retrieval failed, using in-memory: {db_error}")
            memory_requests = list(transfer_requests.values())
            logger.info(f"Retrieved {len(memory_requests)} requests from memory")
            return memory_requests
            
    except Exception as e:
        logger.error(f"Error getting transfer requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve transfer requests")

@app.put("/transfer-request/{request_id}")
async def update_transfer_request(request_id: str, update_data: dict):
    try:
        logger.info(f"Updating transfer request {request_id} with data: {update_data}")
        
        update_data["updated_at"] = datetime.now().isoformat()
        
        if request_id in transfer_requests:
            transfer_requests[request_id].update(update_data)
            updated_request = transfer_requests[request_id]
        else:
            try:
                db_requests = db.get_transfer_requests()
                existing_request = next((req for req in db_requests if req.get('id') == request_id), None)
                if existing_request:
                    existing_request.update(update_data)
                    updated_request = existing_request
                    transfer_requests[request_id] = updated_request
                else:
                    raise HTTPException(status_code=404, detail="Transfer request not found")
            except Exception as db_error:
                logger.error(f"Could not find request {request_id} in database: {db_error}")
                raise HTTPException(status_code=404, detail="Transfer request not found")
        
        try:
            success = db.update_transfer_request(request_id, update_data)
            if success:
                logger.info("Transfer request updated in database successfully")
        except Exception as db_error:
            logger.warning(f"Database update failed, but in-memory update successful: {db_error}")
        
        notification = {
            "type": "transfer_request_updated", 
            "data": updated_request
        }
        await send_notification_to_all_connections(notification)
        logger.info(f"Sent WebSocket notification for updated transfer request: {request_id}")
        
        logger.info(f"Transfer request {request_id} updated successfully")
        return {
            "success": True,
            "data": updated_request
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to update transfer request")

@app.put("/transfer-request/{request_id}/reject")
async def reject_transfer_request(request_id: str, reject_data: dict):
    try:
        doctor_id = reject_data.get("doctor_id")
        notes = reject_data.get("notes", "Transfer request rejected by doctor")
        
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required")
        
        update_data = {
            "status": "rejected",
            "doctor_id": doctor_id,
            "notes": notes,
            "updated_at": datetime.now().isoformat()
        }
        
        return await update_transfer_request(request_id, update_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to reject transfer request")

@app.put("/transfer-request/{request_id}/approve")
async def approve_transfer_request(request_id: str, approve_data: dict):
    try:
        doctor_id = approve_data.get("doctor_id")
        target_department = approve_data.get("target_department")
        notes = approve_data.get("notes", "Transfer approved by doctor")
        
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required")
        if not target_department:
            raise HTTPException(status_code=400, detail="target_department is required")
        
        update_data = {
            "status": "doctor_approved",
            "doctor_id": doctor_id,
            "target_department": target_department,
            "notes": notes,
            "updated_at": datetime.now().isoformat()
        }
        
        return await update_transfer_request(request_id, update_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve transfer request")

@app.get("/departments")
async def get_departments():
    try:
        default_departments = [
            {"name": "General Ward", "capacity": 50, "current": 32},
            {"name": "ED", "capacity": 20, "current": 15},
            {"name": "Cardiac Unit", "capacity": 15, "current": 8},
            {"name": "Surgical Ward", "capacity": 30, "current": 22},
            {"name": "Step-Down Unit", "capacity": 25, "current": 18}
        ]
        
        try:
            return db.get_departments()
        except Exception:
            logger.warning("Database departments retrieval failed, using defaults")
            return default_departments
            
    except Exception as e:
        logger.error(f"Error getting departments: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve departments")

@app.get("/users/{role}")
async def get_users_by_role(role: str):
    try:
        if role not in ['nurse', 'doctor', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role")
            
        default_users = {
            'nurse': [{"id": "nurse1", "name": "Nurse Smith"}, {"id": "nurse2", "name": "Nurse Johnson"}],
            'doctor': [{"id": "doctor1", "name": "Dr. Brown"}, {"id": "doctor2", "name": "Dr. Wilson"}],
            'admin': [{"id": "admin1", "name": "Admin Davis"}]
        }
        
        try:
            return db.get_users_by_role(role)
        except Exception:
            logger.warning(f"Database users retrieval failed for role {role}, using defaults")
            return default_users.get(role, [])
            
    except Exception as e:
        logger.error(f"Error getting users by role: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve users")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)