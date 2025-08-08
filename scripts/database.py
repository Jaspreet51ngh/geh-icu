import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from uuid import uuid4

logger = logging.getLogger(__name__)

class ICUDatabase:
    def __init__(self, db_path: str = "icu_transfer_system.db"):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        """Get database connection with proper configuration"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        return conn
    
    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create departments table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS departments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    capacity INTEGER DEFAULT 50,
                    current_occupancy INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('nurse', 'doctor', 'admin')),
                    department_id INTEGER,
                    password_hash TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments (id)
                )
            """)
            
            # Create patients table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    admission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    department_id INTEGER DEFAULT 1,
                    bed_number TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments (id)
                )
            """)
            
            # Create patient_vitals table (current vitals)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_vitals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    heart_rate REAL NOT NULL,
                    spO2 REAL NOT NULL,
                    respiratory_rate REAL NOT NULL,
                    systolic_bp REAL NOT NULL,
                    lactate REAL NOT NULL,
                    gcs REAL NOT NULL,
                    on_ventilator BOOLEAN DEFAULT 0,
                    on_pressors BOOLEAN DEFAULT 0,
                    comorbidity_score REAL DEFAULT 0,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id)
                )
            """)
            
            # Create patient_vitals_history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_vitals_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    heart_rate REAL NOT NULL,
                    spO2 REAL NOT NULL,
                    respiratory_rate REAL NOT NULL,
                    systolic_bp REAL NOT NULL,
                    lactate REAL NOT NULL,
                    gcs REAL NOT NULL,
                    on_ventilator BOOLEAN DEFAULT 0,
                    on_pressors BOOLEAN DEFAULT 0,
                    comorbidity_score REAL DEFAULT 0,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id)
                )
            """)
            
            # Create patient_predictions table for caching ML predictions
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    ml_prediction TEXT NOT NULL,
                    prediction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id)
                )
            """)
            
            # Create transfer_requests table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transfer_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE NOT NULL,
                    patient_id INTEGER NOT NULL,
                    requesting_nurse_id INTEGER NOT NULL,
                    reviewing_doctor_id INTEGER,
                    target_department_id INTEGER,
                    current_status TEXT NOT NULL DEFAULT 'pending' 
                        CHECK (current_status IN ('pending', 'doctor_approved', 'doctor_rejected', 'admin_approved', 'admin_rejected', 'completed')),
                    ml_prediction TEXT,  -- JSON string with prediction data
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id),
                    FOREIGN KEY (requesting_nurse_id) REFERENCES users (id),
                    FOREIGN KEY (reviewing_doctor_id) REFERENCES users (id),
                    FOREIGN KEY (target_department_id) REFERENCES departments (id)
                )
            """)
            
            # Create transfer_approvals table (audit trail)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transfer_approvals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transfer_request_id INTEGER NOT NULL,
                    approver_id INTEGER NOT NULL,
                    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
                    comments TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (transfer_request_id) REFERENCES transfer_requests (id),
                    FOREIGN KEY (approver_id) REFERENCES users (id)
                )
            """)

            # Create discharged_patients table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS discharged_patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    patient_external_id TEXT NOT NULL,
                    patient_name TEXT NOT NULL,
                    time_discharged TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target_department_id INTEGER,
                    target_department_name TEXT,
                    requesting_nurse_username TEXT,
                    doctor_username TEXT,
                    admin_username TEXT,
                    transfer_request_id INTEGER,
                    notes TEXT,
                    FOREIGN KEY (patient_id) REFERENCES patients (id),
                    FOREIGN KEY (target_department_id) REFERENCES departments (id)
                )
            """)

            # Create patient_ready_state table for persistent ready-since tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_ready_state (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL UNIQUE,
                    ready_since TIMESTAMP,
                    currently_ready BOOLEAN DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id)
                )
            """)
            
            conn.commit()
            
            # Insert default data
            self.insert_default_data()
    
    def insert_default_data(self):
        """Insert default departments and users"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Insert default departments
            departments = [
                ("ICU", 20, 0),
                ("General Ward", 50, 0),
                ("Cardiac Unit", 15, 0),
                ("Surgical Ward", 30, 0),
                ("Emergency Department", 25, 0),
                ("Step-Down Unit", 20, 0)
            ]
            
            for dept in departments:
                cursor.execute("""
                    INSERT OR IGNORE INTO departments (name, capacity, current_occupancy)
                    VALUES (?, ?, ?)
                """, dept)
            
            # Insert default users
            users = [
                ("nurse_sarah", "nurse", 1, "password123"),
                ("nurse_mike", "nurse", 1, "password123"),
                ("dr_smith", "doctor", 1, "password123"),
                ("dr_jones", "doctor", 1, "password123"),
                ("admin_cardiac", "admin", 3, "password123"),
                ("admin_general", "admin", 2, "password123")
            ]
            
            for user in users:
                cursor.execute("""
                    INSERT OR IGNORE INTO users (username, role, department_id, password_hash)
                    VALUES (?, ?, ?, ?)
                """, user)
            
            conn.commit()
    
    # Patient operations
    def add_patient(self, patient_data: Dict[str, Any]) -> int:
        """Add a new patient"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO patients (patient_id, name, age, bed_number)
                VALUES (?, ?, ?, ?)
            """, (patient_data['id'], patient_data['name'], patient_data['age'], f"Bed-{patient_data['id']}"))
            
            patient_db_id = cursor.lastrowid
            
            # Add current vitals
            vitals = patient_data['vitals']
            cursor.execute("""
                INSERT INTO patient_vitals 
                (patient_id, heart_rate, spO2, respiratory_rate, systolic_bp, lactate, gcs, 
                 on_ventilator, on_pressors, comorbidity_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                patient_db_id, vitals['heartRate'], vitals['spO2'], vitals['respiratoryRate'],
                vitals['systolicBP'], vitals['lactate'], vitals['gcs'],
                patient_data['onVentilator'], patient_data['onPressors'], patient_data.get('comorbidityScore', 0)
            ))
            
            conn.commit()
            return patient_db_id
    
    def update_patient_vitals(self, patient_db_id: int, vitals: Dict[str, Any], 
                            on_ventilator: bool, on_pressors: bool, comorbidity_score: float):
        """Update patient vitals and add to history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Add to history first
            cursor.execute("""
                INSERT INTO patient_vitals_history 
                (patient_id, heart_rate, spO2, respiratory_rate, systolic_bp, lactate, gcs,
                 on_ventilator, on_pressors, comorbidity_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                patient_db_id, vitals['heartRate'], vitals['spO2'], vitals['respiratoryRate'],
                vitals['systolicBP'], vitals['lactate'], vitals['gcs'],
                on_ventilator, on_pressors, comorbidity_score
            ))
            
            # Update current vitals
            cursor.execute("""
                UPDATE patient_vitals SET
                heart_rate = ?, spO2 = ?, respiratory_rate = ?, systolic_bp = ?, 
                lactate = ?, gcs = ?, on_ventilator = ?, on_pressors = ?, 
                comorbidity_score = ?, recorded_at = CURRENT_TIMESTAMP
                WHERE patient_id = ?
            """, (
                vitals['heartRate'], vitals['spO2'], vitals['respiratoryRate'],
                vitals['systolicBP'], vitals['lactate'], vitals['gcs'],
                on_ventilator, on_pressors, comorbidity_score, patient_db_id
            ))
            
            conn.commit()
    
    def get_all_patients(self) -> List[Dict[str, Any]]:
        """Get all active patients with current vitals"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.*, pv.*, d.name as department_name
                FROM patients p
                LEFT JOIN patient_vitals pv ON p.id = pv.patient_id
                LEFT JOIN departments d ON p.department_id = d.id
                WHERE p.is_active = 1
                ORDER BY p.patient_id
            """)
            
            patients = []
            for row in cursor.fetchall():
                patient = {
                    'id': row['patient_id'],
                    'name': row['name'],
                    'age': row['age'],
                    'department': row['department_name'],
                    'bed': row['bed_number'],
                    'vitals': {
                        'heartRate': row['heart_rate'],
                        'spO2': row['spO2'],
                        'respiratoryRate': row['respiratory_rate'],
                        'systolicBP': row['systolic_bp'],
                        'lactate': row['lactate'],
                        'gcs': row['gcs']
                    },
                    'onVentilator': bool(row['on_ventilator']),
                    'onPressors': bool(row['on_pressors']),
                    'comorbidityScore': row['comorbidity_score'],
                    'admissionDate': row['admission_date'],
                    'lastUpdated': row['recorded_at']
                }
                patients.append(patient)
            
            return patients
    
    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Get a single patient by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.*, pv.*, d.name as department_name
                FROM patients p
                LEFT JOIN patient_vitals pv ON p.id = pv.patient_id
                LEFT JOIN departments d ON p.department_id = d.id
                WHERE p.patient_id = ? AND p.is_active = 1
            """, (patient_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            patient = {
                'id': row['patient_id'],
                'name': row['name'],
                'age': row['age'],
                'department': row['department_name'],
                'bed': row['bed_number'],
                'vitals': {
                    'heartRate': row['heart_rate'],
                    'spO2': row['spO2'],
                    'respiratoryRate': row['respiratory_rate'],
                    'systolicBP': row['systolic_bp'],
                    'lactate': row['lactate'],
                    'gcs': row['gcs']
                },
                'onVentilator': bool(row['on_ventilator']),
                'onPressors': bool(row['on_pressors']),
                'comorbidityScore': row['comorbidity_score'],
                'admissionDate': row['admission_date'],
                'lastUpdated': row['recorded_at']
            }
            
            return patient
    
    def get_cached_prediction(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Get cached ML prediction for a patient"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ml_prediction, prediction_timestamp
                FROM patient_predictions
                WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?)
                ORDER BY prediction_timestamp DESC
                LIMIT 1
            """, (patient_id,))
            
            row = cursor.fetchone()
            if row and row['ml_prediction']:
                import json
                prediction_data = json.loads(row['ml_prediction'])
                
                # Convert to the format expected by the frontend
                if isinstance(prediction_data, dict):
                    return {
                        "prediction": prediction_data.get("prediction", "Not Ready"),
                        "probability": prediction_data.get("probability", 0.0),
                        "confidence": prediction_data.get("confidence", 0.0),
                        "explanation": prediction_data.get("explanation", "Cached prediction"),
                        "risk_factors": prediction_data.get("risk_factors", []),
                        "model_version": prediction_data.get("model_version", "1.0.0"),
                        "timestamp": prediction_data.get("timestamp", "")
                    }
                return prediction_data
            return None
    
    def cache_prediction(self, patient_id: str, prediction: Dict[str, Any]) -> None:
        """Cache ML prediction for a patient"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get patient database ID
            cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (patient_id,))
            patient_result = cursor.fetchone()
            if not patient_result:
                return
            
            patient_db_id = patient_result['id']
            
            # Convert prediction to dictionary if it's a Pydantic model
            if hasattr(prediction, 'dict'):
                prediction_dict = prediction.dict()
            elif hasattr(prediction, '__dict__'):
                prediction_dict = prediction.__dict__
            else:
                prediction_dict = prediction
            
            # Insert or update prediction
            import json
            prediction_json = json.dumps(prediction_dict)
            
            cursor.execute("""
                INSERT INTO patient_predictions (patient_id, ml_prediction)
                VALUES (?, ?)
            """, (patient_db_id, prediction_json))
            
            conn.commit()
    
    # Transfer request operations
    def create_transfer_request(self, request_data: Dict[str, Any]) -> str:
        """Create a new transfer request"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get patient database ID
            cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (request_data['patient_id'],))
            patient_result = cursor.fetchone()
            if not patient_result:
                raise ValueError(f"Patient {request_data['patient_id']} not found")
            patient_db_id = patient_result['id']
            
            # Handle nurse ID - frontend sends simple IDs like "nurse1", but DB has usernames like "nurse_sarah"
            nurse_id = request_data['nurse_id']
            if nurse_id.startswith('nurse'):
                # Map simple nurse IDs to database usernames
                nurse_mapping = {
                    'nurse1': 'nurse_sarah',
                    'nurse2': 'nurse_mike'
                }
                nurse_username = nurse_mapping.get(nurse_id, 'nurse_sarah')  # Default to nurse_sarah
            else:
                nurse_username = nurse_id
            
            # Get nurse database ID
            cursor.execute("SELECT id FROM users WHERE username = ?", (nurse_username,))
            nurse_result = cursor.fetchone()
            if not nurse_result:
                # Create a default nurse if not found
                cursor.execute("""
                    INSERT INTO users (username, role, department_id, password_hash)
                    VALUES (?, 'nurse', 1, 'password123')
                """, (nurse_username,))
                nurse_db_id = cursor.lastrowid
            else:
                nurse_db_id = nurse_result['id']
            
            # Generate unique request ID
            request_id = f"TR-{datetime.now().strftime('%Y%m%d')}-{patient_db_id:03d}-{uuid4().hex[:6]}"
            
            cursor.execute("""
                INSERT INTO transfer_requests 
                (request_id, patient_id, requesting_nurse_id, ml_prediction, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (
                request_id, patient_db_id, nurse_db_id,
                json.dumps(request_data.get('ml_prediction', {})),
                request_data.get('notes', '')
            ))
            
            conn.commit()
            return request_id
    
    def get_transfer_requests(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get transfer requests with optional status filter"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT tr.*, p.patient_id as patient_external_id, p.name as patient_name,
                       u1.username as nurse_name, u2.username as doctor_name,
                       d.name as target_department_name
                FROM transfer_requests tr
                LEFT JOIN patients p ON tr.patient_id = p.id
                LEFT JOIN users u1 ON tr.requesting_nurse_id = u1.id
                LEFT JOIN users u2 ON tr.reviewing_doctor_id = u2.id
                LEFT JOIN departments d ON tr.target_department_id = d.id
            """
            
            params = []
            if status:
                query += " WHERE tr.current_status = ?"
                params.append(status)
            
            query += " ORDER BY tr.created_at DESC"
            
            cursor.execute(query, params)
            
            requests = []
            for row in cursor.fetchall():
                request = {
                    'id': row['request_id'],
                    'patient_id': row['patient_external_id'],
                    'patient_name': row['patient_name'],
                    'nurse_id': row['nurse_name'],
                    'doctor_id': row['doctor_name'],
                    'target_department': row['target_department_name'],
                    'status': row['current_status'],
                    'notes': row['notes'],
                    'ml_prediction': json.loads(row['ml_prediction']) if row['ml_prediction'] else {},
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at']
                }
                requests.append(request)
            
            return requests
    
    def update_transfer_request(self, request_id: str, update_data: Dict[str, Any]) -> bool:
        """Update transfer request status with proper role handling and department mapping"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get current request
            cursor.execute("SELECT * FROM transfer_requests WHERE request_id = ?", (request_id,))
            current_request = cursor.fetchone()
            
            if not current_request:
                return False
            
            # Normalize and validate status based on actor
            requested_status = update_data.get('status', current_request['current_status'])
            new_status = requested_status

            # Map simple department name to id if provided
            target_department_id = current_request['target_department_id']
            if 'target_department_id' in update_data and update_data['target_department_id']:
                target_department_id = update_data['target_department_id']
            elif 'target_department' in update_data and update_data['target_department']:
                cursor.execute("SELECT id FROM departments WHERE name = ?", (update_data['target_department'],))
                dept_row = cursor.fetchone()
                if dept_row:
                    target_department_id = dept_row['id']

            # Determine actor and normalize status for DB CHECK constraint
            approver_db_id = None
            
            # Handle doctor ID mapping
            reviewing_doctor_id = None
            if 'doctor_id' in update_data and update_data['doctor_id']:
                doctor_id = update_data['doctor_id']
                if doctor_id.startswith('doctor'):
                    # Map simple doctor IDs to database usernames
                    doctor_mapping = {
                        'doctor1': 'dr_smith',
                        'doctor2': 'dr_jones'
                    }
                    doctor_username = doctor_mapping.get(doctor_id, 'dr_smith')
                else:
                    doctor_username = doctor_id
                
                # Get or create doctor
                cursor.execute("SELECT id FROM users WHERE username = ?", (doctor_username,))
                doctor_result = cursor.fetchone()
                if doctor_result:
                    reviewing_doctor_id = doctor_result['id']
                else:
                    # Create default doctor if not found
                    cursor.execute("""
                        INSERT INTO users (username, role, department_id, password_hash)
                        VALUES (?, 'doctor', 1, 'password123')
                    """, (doctor_username,))
                    reviewing_doctor_id = cursor.lastrowid
            
            cursor.execute("""
                UPDATE transfer_requests SET
                current_status = ?, target_department_id = ?, reviewing_doctor_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE request_id = ?
            """, (
                new_status,
                update_data.get('target_department_id'),
                reviewing_doctor_id,
                update_data.get('notes', current_request['notes']),
                request_id
            ))
            
            # Handle doctor actions
            if 'doctor_id' in update_data and update_data['doctor_id']:
                doctor_id = update_data['doctor_id']
                if doctor_id.startswith('doctor'):
                    doctor_mapping = {
                        'doctor1': 'dr_smith',
                        'doctor2': 'dr_jones'
                    }
                    doctor_username = doctor_mapping.get(doctor_id, 'dr_smith')
                else:
                    doctor_username = doctor_id

                cursor.execute("SELECT id FROM users WHERE username = ?", (doctor_username,))
                doctor_result = cursor.fetchone()
                if doctor_result:
                    reviewing_doctor_id = doctor_result['id']
                else:
                    cursor.execute("""
                        INSERT INTO users (username, role, department_id, password_hash)
                        VALUES (?, 'doctor', 1, 'password123')
                    """, (doctor_username,))
                    reviewing_doctor_id = cursor.lastrowid

                # Normalize status for doctor
                if requested_status in ['approved', 'doctor_approved']:
                    new_status = 'doctor_approved'
                elif requested_status in ['rejected', 'doctor_rejected']:
                    new_status = 'doctor_rejected'
                approver_db_id = reviewing_doctor_id
            else:
                reviewing_doctor_id = current_request['reviewing_doctor_id']

            # Handle admin actions
            if 'admin_id' in update_data and update_data['admin_id']:
                admin_id = update_data['admin_id']
                if isinstance(admin_id, str) and admin_id.startswith('admin'):
                    admin_username = admin_id
                else:
                    admin_username = admin_id
                cursor.execute("SELECT id, role FROM users WHERE username = ?", (admin_username,))
                admin_result = cursor.fetchone()
                if not admin_result:
                    cursor.execute("""
                        INSERT INTO users (username, role, department_id, password_hash)
                        VALUES (?, 'admin', 1, 'password123')
                    """, (admin_username,))
                    admin_db_id = cursor.lastrowid
                else:
                    admin_db_id = admin_result['id']

                # Normalize status for admin
                if requested_status in ['approved', 'admin_approved']:
                    new_status = 'admin_approved'
                elif requested_status in ['rejected', 'admin_rejected']:
                    new_status = 'admin_rejected'
                approver_db_id = admin_db_id

            # Fallback normalization to allowed values
            allowed_statuses = ['pending', 'doctor_approved', 'doctor_rejected', 'admin_approved', 'admin_rejected', 'completed']
            if new_status not in allowed_statuses:
                new_status = current_request['current_status']

            # Apply update
            cursor.execute("""
                UPDATE transfer_requests SET
                current_status = ?, target_department_id = ?, reviewing_doctor_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE request_id = ?
            """, (
                new_status,
                target_department_id,
                reviewing_doctor_id,
                update_data.get('notes', current_request['notes']),
                request_id
            ))

            # Add approval record if applicable
            if approver_db_id is not None and requested_status in ['approved', 'doctor_approved', 'admin_approved', 'rejected', 'doctor_rejected', 'admin_rejected']:
                cursor.execute("SELECT id FROM transfer_requests WHERE request_id = ?", (request_id,))
                tr_row = cursor.fetchone()
                if tr_row:
                    cursor.execute("""
                        INSERT INTO transfer_approvals (transfer_request_id, approver_id, action, comments)
                        VALUES (?, ?, ?, ?)
                    """, (
                        tr_row['id'],
                        approver_db_id,
                        'approved' if new_status in ['doctor_approved', 'admin_approved'] else 'rejected',
                        update_data.get('comments', '')
                    ))
            
            conn.commit()
            return True

    def set_ready_state(self, patient_external_id: str, is_ready: bool, timestamp: Optional[str] = None) -> None:
        """Persist or clear ready_since for a patient depending on is_ready flag."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (patient_external_id,))
            row = cursor.fetchone()
            if not row:
                return
            pid = row['id']
            if is_ready:
                # Insert if absent, set ready_since if not set
                cursor.execute("SELECT ready_since FROM patient_ready_state WHERE patient_id = ?", (pid,))
                rs = cursor.fetchone()
                if rs is None:
                    cursor.execute(
                        "INSERT INTO patient_ready_state (patient_id, ready_since, currently_ready) VALUES (?, ?, 1)",
                        (pid, timestamp or datetime.now().isoformat()),
                    )
                else:
                    if not rs['ready_since']:
                        cursor.execute(
                            "UPDATE patient_ready_state SET ready_since = ?, currently_ready = 1, updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?",
                            (timestamp or datetime.now().isoformat(), pid),
                        )
                    else:
                        cursor.execute(
                            "UPDATE patient_ready_state SET currently_ready = 1, updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?",
                            (pid,),
                        )
            else:
                # Clear current readiness and ready_since
                cursor.execute(
                    "INSERT INTO patient_ready_state (patient_id, ready_since, currently_ready) VALUES (?, NULL, 0) ON CONFLICT(patient_id) DO UPDATE SET ready_since = NULL, currently_ready = 0, updated_at = CURRENT_TIMESTAMP",
                    (pid,),
                )
            conn.commit()

    def get_ready_since(self, patient_external_id: str) -> Optional[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT prs.ready_since FROM patient_ready_state prs JOIN patients p ON prs.patient_id = p.id WHERE p.patient_id = ? AND prs.currently_ready = 1",
                (patient_external_id,),
            )
            row = cursor.fetchone()
            return row['ready_since'] if row and row['ready_since'] else None

    def get_patient_internal_id(self, patient_external_id: str) -> Optional[int]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (patient_external_id,))
            row = cursor.fetchone()
            return row['id'] if row else None

    def discharge_patient(self, request_id: str, nurse_username: Optional[str] = None, notes: str = "") -> bool:
        """Move patient from active patients to discharged_patients and complete transfer request"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Load transfer request and related info
            cursor.execute("""
                SELECT tr.*, p.patient_id AS patient_external_id, p.id AS patient_internal_id, p.name AS patient_name,
                       u1.username AS nurse_username, u2.username AS doctor_username, d.name AS department_name
                FROM transfer_requests tr
                LEFT JOIN patients p ON tr.patient_id = p.id
                LEFT JOIN users u1 ON tr.requesting_nurse_id = u1.id
                LEFT JOIN users u2 ON tr.reviewing_doctor_id = u2.id
                LEFT JOIN departments d ON tr.target_department_id = d.id
                WHERE tr.request_id = ?
            """, (request_id,))
            tr = cursor.fetchone()
            if not tr:
                return False

            # Insert into discharged_patients
            cursor.execute("""
                INSERT INTO discharged_patients (
                    patient_id, patient_external_id, patient_name, target_department_id, target_department_name,
                    requesting_nurse_username, doctor_username, admin_username, transfer_request_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT id FROM transfer_requests WHERE request_id = ?), ?)
            """, (
                tr['patient_internal_id'],
                tr['patient_external_id'],
                tr['patient_name'],
                tr['target_department_id'],
                tr['department_name'],
                tr['nurse_username'],
                tr['doctor_username'],
                nurse_username or tr['nurse_username'],  # store nurse performing shift in admin_username if not available
                request_id,
                notes or (tr['notes'] or '')
            ))

            # Mark patient inactive (logically removed)
            cursor.execute("UPDATE patients SET is_active = 0 WHERE id = ?", (tr['patient_internal_id'],))

            # Complete transfer request
            cursor.execute("UPDATE transfer_requests SET current_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?", (request_id,))

            conn.commit()
            return True

    def get_discharged_patients(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT dp.*, COALESCE(d.name, dp.target_department_name) AS dept_name
                FROM discharged_patients dp
                LEFT JOIN departments d ON dp.target_department_id = d.id
                ORDER BY dp.time_discharged DESC
            """)
            results = []
            for row in cursor.fetchall():
                results.append({
                    'patient_id': row['patient_external_id'],
                    'name': row['patient_name'],
                    'time_discharged': row['time_discharged'],
                    'target_department': row['dept_name'],
                    'approved_by_nurse': row['requesting_nurse_username'],
                    'approved_by_doctor': row['doctor_username'],
                    'approved_by_admin': row['admin_username'],
                    'transfer_request_id': row['transfer_request_id'],
                    'notes': row['notes'],
                })
            return results
    
    # Department operations
    def get_departments(self) -> List[Dict[str, Any]]:
        """Get all departments"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM departments ORDER BY name")
            
            departments = []
            for row in cursor.fetchall():
                dept = {
                    'id': row['id'],
                    'name': row['name'],
                    'capacity': row['capacity'],
                    'current_occupancy': row['current_occupancy'],
                    'available_beds': row['capacity'] - row['current_occupancy']
                }
                departments.append(dept)
            
            return departments
    
    # User operations
    def get_users_by_role(self, role: str) -> List[Dict[str, Any]]:
        """Get users by role"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.*, d.name as department_name
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE u.role = ? AND u.is_active = 1
                ORDER BY u.username
            """, (role,))
            
            users = []
            for row in cursor.fetchall():
                user = {
                    'id': row['id'],
                    'username': row['username'],
                    'role': row['role'],
                    'department': row['department_name'],
                    'is_active': bool(row['is_active'])
                }
                users.append(user)
            
            return users

# Global database instance
db = ICUDatabase() 