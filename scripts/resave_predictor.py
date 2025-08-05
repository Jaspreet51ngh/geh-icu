# resave_predictor.py
from robust_predictor import RobustICUPredictor
import joblib

# Specify the correct model directory
predictor = RobustICUPredictor(model_dir="models")

# Save the complete predictor to the root folder
joblib.dump(predictor, "robust_icu_predictor.pkl")

print("✅ robust_icu_predictor.pkl re-saved successfully.")
