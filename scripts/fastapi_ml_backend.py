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
import csv
import asyncio

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

async def broadcast_vitals_and_prediction_update(patient_external_id: str):
    try:
        patient = db.get_patient(patient_external_id)
        if not patient:
            return
        vitals = {
            "patient_id": patient['id'],
            "heartRate": patient['vitals']['heartRate'],
            "spO2": patient['vitals']['spO2'],
            "respiratoryRate": patient['vitals']['respiratoryRate'],
            "systolicBP": patient['vitals']['systolicBP'],
            "lactate": patient['vitals']['lactate'],
            "gcs": patient['vitals']['gcs'],
            "timestamp": datetime.now().isoformat(),
        }
        await send_notification_to_all_connections({"type": "vitals_update", "data": vitals})
    except Exception as e:
        logger.warning(f"Failed to broadcast update: {e}")

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

def _passes_clinical_rules(p: dict) -> bool:
    try:
        if p.get('onVentilator') or p.get('onPressors'):
            return False
        # Simple hemodynamic stability heuristic
        hr = p['vitals']['heartRate']
        spo2 = p['vitals']['spO2']
        resp = p['vitals']['respiratoryRate']
        sbp = p['vitals']['systolicBP']
        lact = p['vitals']['lactate']
        gcs = p['vitals']['gcs']
        stable = (60 <= hr <= 110) and (spo2 >= 94) and (12 <= resp <= 22) and (90 <= sbp <= 160) and (lact < 2.2) and (gcs >= 13)
        return stable
    except Exception:
        return False

# async def simulate_vitals_loop():
#     """Background task to simulate vitals every 5–10 seconds across all active patients, refresh predictions, and maintain ready_since."""
#     await asyncio.sleep(2)
#     while True:
#         try:
#             await asyncio.sleep(random.randint(1, 2))
#             patients = db.get_all_patients()
#             if not patients:
#                 continue
#             for patient in patients:
#                 # Random small perturbations
#                 new_vitals = {
#                     "heartRate": max(40, min(140, patient['vitals']['heartRate'] + random.uniform(-3, 3))),
#                     "spO2": max(85, min(100, patient['vitals']['spO2'] + random.uniform(-0.8, 0.8))),
#                     "respiratoryRate": max(8, min(30, patient['vitals']['respiratoryRate'] + random.uniform(-1.5, 1.5))),
#                     "systolicBP": max(80, min(200, patient['vitals']['systolicBP'] + random.uniform(-4, 4))),
#                     "lactate": max(0.5, min(6.0, patient['vitals']['lactate'] + random.uniform(-0.15, 0.15))),
#                     "gcs": max(3, min(15, patient['vitals']['gcs'] + random.uniform(-0.2, 0.2))),
#                 }

#                 db.update_patient_vitals(
#                     patient_db_id=db.get_patient_internal_id(patient['id']) or 0,
#                     vitals=new_vitals,
#                     on_ventilator=patient['onVentilator'],
#                     on_pressors=patient['onPressors'],
#                     comorbidity_score=patient.get('comorbidityScore', 0) or 0,
#                 )

#                 # Recompute prediction and cache
#                 try:
#                     pdata = PatientData(
#                         HR=new_vitals['heartRate'],
#                         SpO2=new_vitals['spO2'],
#                         RESP=new_vitals['respiratoryRate'],
#                         ABPsys=new_vitals['systolicBP'],
#                         lactate=new_vitals['lactate'],
#                         gcs=new_vitals['gcs'],
#                         age=patient['age'],
#                         comorbidity_score=patient.get('comorbidityScore', 0) or 0,
#                         on_vent=patient['onVentilator'],
#                         on_pressors=patient['onPressors'],
#                     )
#                     pred = await predict_transfer_readiness(pdata)
#                     db.cache_prediction(patient['id'], pred.dict())

#                     # Gate blinking state by clinical rules and no transfer request
#                     ready_by_ml = (pred.prediction == "Ready")
#                     if ready_by_ml and _passes_clinical_rules({**patient, 'vitals': new_vitals}):
#                         # Ensure no active transfer request exists for this patient
#                         try:
#                             requests = db.get_transfer_requests()
#                             has_any = any(r.get('patient_id') == patient['id'] and r.get('status') in ['pending','doctor_approved','admin_approved','completed'] for r in requests)
#                         except Exception:
#                             has_any = False
#                         if not has_any:
#                             db.set_ready_state(patient['id'], True, pred.timestamp)
#                         else:
#                             db.set_ready_state(patient['id'], False)
#                     else:
#                         db.set_ready_state(patient['id'], False)
#                 except Exception as e:
#                     logger.warning(f"Prediction refresh failed: {e}")

#                 await broadcast_vitals_and_prediction_update(patient['id'])
#         except Exception as e:
#             logger.error(f"Vitals simulation loop error: {e}")


async def simulate_static_vitals_from_csv(csv_path: str):
    """Loop over a single-row CSV and simulate vitals for one DB patient every second."""
    await asyncio.sleep(2)
    try:
        patients = db.get_all_patients()
        if not patients:
            logger.error("No patients found in the DB.")
            return

        patient = patients[0]  # Or choose another index if needed
        patient_id = patient['id']
        patient_db_id = db.get_patient_internal_id(patient_id)

        with open(csv_path, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            row = next(reader)  # Just the first row

            while True:
                new_vitals = {
                    "heartRate": float(row['HR']),
                    "spO2": float(row['SpO2']),
                    "respiratoryRate": float(row['RESP']),
                    "systolicBP": float(row['ABPsys']),
                    "lactate": float(row['lactate']),
                    "gcs": float(row['gcs']),
                }

                db.update_patient_vitals(
                    patient_db_id=patient_db_id,
                    vitals=new_vitals,
                    on_ventilator=row['on_vent'].lower() == "true",
                    on_pressors=row['on_pressors'].lower() == "true",
                    comorbidity_score=int(row['comorbidity_score']),
                )

                try:
                    pdata = PatientData(
                        HR=new_vitals['heartRate'],
                        SpO2=new_vitals['spO2'],
                        RESP=new_vitals['respiratoryRate'],
                        ABPsys=new_vitals['systolicBP'],
                        lactate=new_vitals['lactate'],
                        gcs=new_vitals['gcs'],
                        age=int(row['age']),
                        comorbidity_score=int(row['comorbidity_score']),
                        on_vent=row['on_vent'].lower() == "true",
                        on_pressors=row['on_pressors'].lower() == "true",
                    )

                    pred = await predict_transfer_readiness(pdata)
                    db.cache_prediction(patient_id, pred.dict())

                    ready_by_ml = pred.prediction == "Ready"
                    if ready_by_ml and _passes_clinical_rules({**patient, 'vitals': new_vitals}):
                        requests = db.get_transfer_requests()
                        has_any = any(
                            r.get('patient_id') == patient_id and r.get('status') in ['pending', 'doctor_approved', 'admin_approved', 'completed']
                        )
                        db.set_ready_state(patient_id, not has_any, pred.timestamp if not has_any else None)
                    else:
                        db.set_ready_state(patient_id, False)

                except Exception as e:
                    logger.warning(f"Prediction refresh failed: {e}")

                await broadcast_vitals_and_prediction_update(patient_id)
                await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Vitals simulation from CSV failed: {e}")


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

@app.get("/api/predict/{patient_id}")
async def get_prediction_for_patient(patient_id: str):
    try:
        cached = db.get_cached_prediction(patient_id)
        if cached is None:
            p = db.get_patient(patient_id)
            if not p:
                raise HTTPException(status_code=404, detail="Patient not found")
            pdata = PatientData(
                HR=p['vitals']['heartRate'], SpO2=p['vitals']['spO2'], RESP=p['vitals']['respiratoryRate'],
                ABPsys=p['vitals']['systolicBP'], lactate=p['vitals']['lactate'], gcs=p['vitals']['gcs'],
                age=p['age'], comorbidity_score=p.get('comorbidityScore', 0) or 0,
                on_vent=p['onVentilator'], on_pressors=p['onPressors']
            )
            pred = await predict_transfer_readiness(pdata)
            db.cache_prediction(patient_id, pred.dict())
            cached = pred.dict()
        # Normalize to minimal shape expected by frontend getMLPrediction helper, include ready_since if tracked
        is_ready = (cached.get('prediction') in ['Ready', 1, True, 'ready'])
        ready_since = db.get_ready_since(patient_id) if is_ready else None
        return {
            "prediction": "ready" if is_ready else "not_ready",
            "timestamp": ready_since or cached.get('timestamp', datetime.now().isoformat()),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get prediction for {patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get prediction")

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

@app.put("/transfer-request/{request_id}/admin-approve")
async def admin_approve_transfer_request(request_id: str, approve_data: dict):
    try:
        admin_id = approve_data.get("admin_id")
        target_department = approve_data.get("target_department")
        notes = approve_data.get("notes", "Transfer approved by admin")

        if not admin_id:
            raise HTTPException(status_code=400, detail="admin_id is required")

        update_data = {
            "status": "admin_approved",
            "admin_id": admin_id,
            "target_department": target_department,
            "notes": notes,
            "updated_at": datetime.now().isoformat()
        }
        return await update_transfer_request(request_id, update_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error admin-approving transfer request: {e}")
        raise HTTPException(status_code=500, detail="Failed to admin-approve transfer request")

@app.post("/transfer-request/{request_id}/discharge")
async def discharge_patient(request_id: str, body: dict):
    try:
        nurse_username = body.get("nurse_id") or body.get("nurse_username") or "nurse_sarah"
        notes = body.get("notes", "")
        ok = db.discharge_patient(request_id, nurse_username=nurse_username, notes=notes)
        if not ok:
            raise HTTPException(status_code=404, detail="Transfer request not found")
        await send_notification_to_all_connections({"type": "patient_discharged", "data": {"request_id": request_id}})
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Discharge failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to discharge patient")

@app.get("/discharged-patients")
async def get_discharged_patients():
    try:
        return db.get_discharged_patients()
    except Exception as e:
        logger.error(f"Failed to fetch discharged patients: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch discharged patients")

@app.post("/add-patient")
async def add_patient(payload: dict):
    try:
        # Build patient data
        name = payload.get('name') or f"Patient {random.randint(1000,9999)}"
        age = int(payload.get('age') or random.randint(18, 90))
        gender = payload.get('gender', 'Unknown')
        vit = payload.get('vitals') or {}
        vitals = {
            "heartRate": float(vit.get('heartRate') or random.uniform(65, 95)),
            "spO2": float(vit.get('spO2') or random.uniform(95, 99)),
            "respiratoryRate": float(vit.get('respiratoryRate') or random.uniform(12, 20)),
            "systolicBP": float(vit.get('systolicBP') or random.uniform(105, 135)),
            "lactate": float(vit.get('lactate') or random.uniform(0.8, 2.0)),
            "gcs": float(vit.get('gcs') or random.uniform(13, 15)),
        }
        new_id = f"ICU-{random.randint(100,999)}"
        patient_data = {
            "id": new_id,
            "name": name,
            "age": age,
            "vitals": vitals,
            "onVentilator": False,
            "onPressors": False,
            "comorbidityScore": 0,
        }
        db.add_patient(patient_data)
        # Warm a prediction cache entry
        pdata = PatientData(
            HR=vitals['heartRate'], SpO2=vitals['spO2'], RESP=vitals['respiratoryRate'], ABPsys=vitals['systolicBP'],
            lactate=vitals['lactate'], gcs=vitals['gcs'], age=age, comorbidity_score=0, on_vent=False, on_pressors=False,
        )
        pred = await predict_transfer_readiness(pdata)
        db.cache_prediction(new_id, pred.dict())
        return {"success": True, "patient_id": new_id}
    except Exception as e:
        logger.error(f"Failed to add patient: {e}")
        raise HTTPException(status_code=500, detail="Failed to add patient")

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
    # Start vitals simulation in background
    loop = asyncio.get_event_loop()
    loop.create_task(simulate_vitals_loop("realistic_icu_data.csv"))
    uvicorn.run(app, host="0.0.0.0", port=8000)