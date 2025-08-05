import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging

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
    
    # Transfer request operations
    def create_transfer_request(self, request_data: Dict[str, Any]) -> str:
        """Create a new transfer request"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get patient database ID
            cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (request_data['patient_id'],))
            patient_db_id = cursor.fetchone()['id']
            
            # Get nurse database ID
            cursor.execute("SELECT id FROM users WHERE username = ?", (request_data['nurse_id'],))
            nurse_db_id = cursor.fetchone()['id']
            
            # Generate unique request ID
            request_id = f"TR-{datetime.now().strftime('%Y%m%d')}-{patient_db_id:03d}"
            
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
        """Update transfer request status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get current request
            cursor.execute("SELECT * FROM transfer_requests WHERE request_id = ?", (request_id,))
            current_request = cursor.fetchone()
            
            if not current_request:
                return False
            
            # Update status
            new_status = update_data.get('status', current_request['current_status'])
            
            cursor.execute("""
                UPDATE transfer_requests SET
                current_status = ?, target_department_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE request_id = ?
            """, (
                new_status,
                update_data.get('target_department_id'),
                update_data.get('notes', current_request['notes']),
                request_id
            ))
            
            # Add approval record
            if 'approver_id' in update_data:
                cursor.execute("""
                    INSERT INTO transfer_approvals (transfer_request_id, approver_id, action, comments)
                    VALUES (?, ?, ?, ?)
                """, (
                    current_request['id'],
                    update_data['approver_id'],
                    'approved' if new_status in ['doctor_approved', 'admin_approved'] else 'rejected',
                    update_data.get('comments', '')
                ))
            
            conn.commit()
            return True
    
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