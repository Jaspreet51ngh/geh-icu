# ICU Transfer Management System

An AI-powered ICU patient transfer management system with real-time monitoring, ML predictions, and role-based workflows.

## 🏥 Project Overview

This system manages ICU patient transfers using:
- **Real-time patient monitoring** with sensor data simulation
- **ML-powered transfer predictions** using your `robust_icu_predictor.pkl` model
- **Role-based workflows** for Nurses, Doctors, and Department Admins
- **Real-time notifications** and approval chains
- **Dynamic dashboards** with live vitals updates

## 🚀 Features

### Core Workflow
1. **Nurses** monitor real-time patient vitals and ML predictions
2. **AI Model** continuously analyzes patient data for transfer readiness
3. **Transfer Requests** initiated by nurses for "transfer ready" patients
4. **Doctor Review** approves/rejects transfer requests
5. **Department Admin** assigns target wards for approved transfers
6. **Real-time Notifications** for all approval stages

### Technical Features
- ✅ FastAPI backend with WebSocket real-time updates
- ✅ ML model integration (`robust_icu_predictor.pkl`)
- ✅ Real-time data streaming from CSV dataset
- ✅ Role-based authentication system
- ✅ Dynamic patient monitoring dashboards
- ✅ Transfer request management
- ✅ Notification system

## 🛠️ Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or pnpm

### Backend Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the FastAPI backend:**
   ```bash
   cd scripts
   python fastapi_ml_backend.py
   ```
   
   The backend will run on `http://localhost:8000`

3. **Verify backend is running:**
   - Visit `http://localhost:8000/health`
   - Should show model and dataset loaded successfully

### Frontend Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Start the Next.js development server:**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```
   
   The frontend will run on `http://localhost:3000`

## 👥 User Roles & Workflows

### Nurse Dashboard (`/dashboard`)
- **Real-time patient monitoring** with live vitals
- **ML predictions** for transfer readiness
- **Initiate transfer requests** for eligible patients
- **View patient status** and clinical parameters

### Doctor Review (`/doctor-review`)
- **Review transfer requests** from nurses
- **View patient vitals** and ML predictions
- **Approve/reject** transfer requests
- **Clinical decision support**

### Department Admin (`/admin-dashboard`)
- **Manage approved transfers**
- **Assign target departments/wards**
- **Track transfer status**
- **Department capacity management**

## 📊 Data Flow

1. **Real-time Data**: CSV dataset simulates sensor data
2. **ML Processing**: `robust_icu_predictor.pkl` analyzes patient vitals
3. **Predictions**: Transfer readiness scores with confidence levels
4. **Frontend Updates**: WebSocket delivers real-time updates
5. **User Actions**: Role-based workflows for transfer management

## 🔧 API Endpoints

### Core Endpoints
- `GET /health` - Backend health check
- `GET /patients` - Get all patients with predictions
- `GET /patient/{id}/vitals` - Get real-time vitals for patient
- `POST /predict` - ML prediction endpoint
- `GET /model-info` - Model information

### Transfer Management
- `GET /transfer-requests` - Get all transfer requests
- `POST /transfer-request` - Create new transfer request
- `PUT /transfer-request/{id}` - Update transfer request status

### WebSocket
- `WS /ws` - Real-time updates for vitals and notifications

## 📁 Project Structure

```
icu-dashboard/
├── app/                    # Next.js frontend pages
│   ├── dashboard/         # Nurse dashboard
│   ├── doctor-review/     # Doctor review interface
│   ├── admin-dashboard/   # Admin management
│   └── patients/          # Patient management
├── components/            # React components
│   ├── patient-card.tsx   # Patient monitoring card
│   ├── transfer-modal.tsx # Transfer request modal
│   └── ui/               # UI components
├── lib/                  # Utility libraries
│   ├── ml-service.ts     # ML API integration
│   └── utils.ts          # Helper functions
├── scripts/              # Backend scripts
│   └── fastapi_ml_backend.py  # FastAPI server
├── realistic_icu_data.csv     # Sample patient data
├── robust_icu_predictor.pkl   # ML model
└── requirements.txt      # Python dependencies
```

## 🎯 Demo Credentials

Use any username with these roles:
- **Nurse**: Monitor patients, initiate transfers
- **Doctor**: Review and approve transfers
- **Department Admin**: Manage ward assignments

## 🔄 Real-time Features

- **Live Vitals**: Patient vitals update every 5 seconds
- **ML Predictions**: Continuous transfer readiness assessment
- **Notifications**: Real-time alerts for transfer requests
- **WebSocket**: Bidirectional communication for live updates

## 🚨 Troubleshooting

### Backend Issues
- Ensure `robust_icu_predictor.pkl` is in the root directory
- Check `realistic_icu_data.csv` exists and is readable
- Verify Python dependencies are installed correctly

### Frontend Issues
- Ensure backend is running on `http://localhost:8000`
- Check browser console for WebSocket connection errors
- Verify all npm dependencies are installed

### ML Model Issues
- Ensure model file path is correct in `fastapi_ml_backend.py`
- Check model input features match the expected format
- Verify scikit-learn version compatibility

## 📈 Future Enhancements

- [ ] Database integration for persistent storage
- [ ] Advanced authentication system
- [ ] Mobile-responsive design
- [ ] Advanced analytics dashboard
- [ ] Integration with hospital EMR systems
- [ ] Multi-hospital support
- [ ] Advanced ML model retraining pipeline

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational and demonstration purposes.

---

**Note**: This is a demonstration system. For production use, implement proper security, authentication, and compliance measures for healthcare applications. 