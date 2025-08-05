# # robust_predictor.py
# import numpy as np
# import pandas as pd
# import pickle
# import joblib
# from sklearn.impute import SimpleImputer, KNNImputer
# from sklearn.preprocessing import StandardScaler, RobustScaler
# from sklearn.base import BaseEstimator, ClassifierMixin
# from sklearn.ensemble import VotingClassifier

# class CustomEnsemble(BaseEstimator, ClassifierMixin):
#     """Custom ensemble that handles XGBoost and sklearn models together"""
    
#     def __init__(self, models_dict):
#         self.models = models_dict
#         self.model_names = list(models_dict.keys())
#         self.is_fitted = False
        
#     def fit(self, X, y):
#         # Models are already fitted in our case
#         self.is_fitted = True
#         return self
        
#     def predict(self, X):
#         """Majority voting prediction"""
#         if not self.is_fitted:
#             raise ValueError("Ensemble must be fitted before prediction")
            
#         predictions = []
#         for name, model in self.models.items():
#             pred = model.predict(X)
#             predictions.append(pred)
        
#         # Majority voting
#         predictions = np.array(predictions)
#         final_pred = np.apply_along_axis(
#             lambda x: np.bincount(x).argmax(), 
#             axis=0, 
#             arr=predictions
#         )
#         return final_pred
        
#     def predict_proba(self, X):
#         """Average probability prediction"""
#         if not self.is_fitted:
#             raise ValueError("Ensemble must be fitted before prediction")
            
#         probabilities = []
#         for name, model in self.models.items():
#             if hasattr(model, 'predict_proba'):
#                 prob = model.predict_proba(X)[:, 1]
#             else:
#                 # For models without predict_proba, use predictions as probabilities
#                 pred = model.predict(X)
#                 prob = pred.astype(float)
#             probabilities.append(prob)
        
#         # Average probabilities
#         avg_prob = np.mean(probabilities, axis=0)
#         # Convert to proper probability format
#         proba_matrix = np.column_stack([1 - avg_prob, avg_prob])
#         return proba_matrix
    
#     @property
#     def feature_importances_(self):
#         """Get average feature importances from models that support it"""
#         importances = []
#         for model in self.models.values():
#             if hasattr(model, 'feature_importances_'):
#                 importances.append(model.feature_importances_)
        
#         if not importances:
#             raise AttributeError("None of the models have feature_importances_")
        
#         return np.mean(importances, axis=0)

# class RobustICUPredictor:
#     """
#     Robust ICU Transfer Readiness Predictor with multiple ensemble options
#     and comprehensive error handling
#     """
    
#     def __init__(self):
#         # Ensemble models
#         self.sklearn_ensemble = None
#         self.custom_ensemble = None
#         self.logistic_xgb_ensemble = None
        
#         # Individual models
#         self.individual_models = {}
        
#         # Preprocessing
#         self.scaler = None
#         self.imputer = None
#         self.features = []
        
#         # Availability flags
#         self.has_sklearn_ensemble = False
#         self.has_custom_ensemble = False
#         self.has_logistic_xgb = False
        
#         # Try to load everything
#         self._load_components()
        
#     def _load_components(self):
#         """Load all available model components"""
#         try:
#             self.scaler = joblib.load("robust_scaler.pkl")
#             self.imputer = joblib.load("knn_imputer.pkl")
#             print("✓ Preprocessing components loaded")
#         except Exception as e:
#             print(f"⚠ Could not load preprocessing objects: {e}")
            
#         # Load sklearn ensemble
#         try:
#             self.sklearn_ensemble = joblib.load("sklearn_ensemble.pkl")
#             self.has_sklearn_ensemble = True
#             print("✓ Scikit-learn ensemble loaded")
#         except Exception as e:
#             print(f"⚠ Scikit-learn ensemble not available: {e}")
            
#         # Load custom ensemble
#         try:
#             with open("custom_ensemble.pkl", "rb") as f:
#                 self.custom_ensemble = pickle.load(f)
#             self.has_custom_ensemble = True
#             print("✓ Custom ensemble loaded")
#         except Exception as e:
#             print(f"⚠ Custom ensemble not available: {e}")
            
#         # Load logistic-xgb ensemble
#         try:
#             with open("logistic_xgb_ensemble.pkl", "rb") as f:
#                 self.logistic_xgb_ensemble = pickle.load(f)
#             self.has_logistic_xgb = True
#             print("✓ Logistic-XGBoost ensemble loaded")
#         except Exception as e:
#             print(f"⚠ Logistic-XGBoost ensemble not available: {e}")
        
#         # Load individual models
#         model_files = [
#             "model_logistic_l1.pkl",
#             "model_logistic_l2.pkl", 
#             "model_logistic_elastic.pkl",
#             "model_random_forest.pkl",
#             "model_extra_trees.pkl",
#             "model_gradient_boost.pkl",
#             "model_xgboost.pkl",
#             "model_xgboost_balanced.pkl",
#             "model_svm_rbf.pkl",
#             "model_svm_linear.pkl",
#             "model_naive_bayes.pkl",
#             "model_knn.pkl",
#             "model_decision_tree.pkl"
#         ]
        
#         for model_file in model_files:
#             try:
#                 model_name = model_file.replace("model_", "").replace(".pkl", "")
#                 self.individual_models[model_name] = joblib.load(model_file)
#                 print(f"✓ {model_name} loaded")
#             except Exception as e:
#                 continue
        
#         print(f"✓ {len(self.individual_models)} individual models loaded")
        
#         # Load features from training results
#         try:
#             import json
#             with open("comprehensive_training_results.json", "r") as f:
#                 results = json.load(f)
#                 self.features = results["training_info"]["features"]
#             print(f"✓ Feature list loaded: {len(self.features)} features")
#         except Exception as e:
#             print(f"⚠ Could not load feature list: {e}")
#             # Fallback feature list based on your data
#             self.features = [
#                 'HR', 'SpO2', 'RESP', 'ABPsys', 'lactate', 'gcs', 
#                 'age', 'comorbidity_score', 'on_vent', 'on_pressors'
#             ]
#             print(f"✓ Using fallback feature list: {self.features}")
    
#     def _prepare_input(self, patient_data):
#         """Prepare patient data for prediction"""
#         if self.scaler is None or self.imputer is None:
#             raise ValueError("Preprocessing objects not available")
            
#         # Create input array in correct feature order
#         input_array = []
#         for feature in self.features:
#             value = patient_data.get(feature, np.nan)
#             input_array.append(value)
        
#         # Convert to numpy array and preprocess
#         input_data = np.array([input_array])
#         input_imputed = self.imputer.transform(input_data)
#         input_scaled = self.scaler.transform(input_imputed)
        
#         return input_scaled
    
#     def predict_dict(self, patient_data, ensemble_type='best'):
#         """
#         Predict transfer readiness with detailed results
        
#         Args:
#             patient_data: Dict with patient features
#             ensemble_type: 'best', 'custom', 'sklearn', 'logistic_xgb', or 'individual'
        
#         Returns:
#             Dict with prediction, probability, confidence, etc.
#         """
#         input_scaled = self._prepare_input(patient_data)
        
#         # Choose ensemble based on availability and type
#         ensemble = None
#         ensemble_name = "Individual models"
        
#         if ensemble_type == 'best':
#             if self.has_custom_ensemble:
#                 ensemble = self.custom_ensemble
#                 ensemble_name = "Custom (with XGBoost)"
#             elif self.has_logistic_xgb:
#                 ensemble = self.logistic_xgb_ensemble
#                 ensemble_name = "Logistic-XGBoost"
#             elif self.has_sklearn_ensemble:
#                 ensemble = self.sklearn_ensemble
#                 ensemble_name = "Scikit-learn"
#         elif ensemble_type == 'custom' and self.has_custom_ensemble:
#             ensemble = self.custom_ensemble
#             ensemble_name = "Custom"
#         elif ensemble_type == 'sklearn' and self.has_sklearn_ensemble:
#             ensemble = self.sklearn_ensemble
#             ensemble_name = "Scikit-learn"
#         elif ensemble_type == 'logistic_xgb' and self.has_logistic_xgb:
#             ensemble = self.logistic_xgb_ensemble
#             ensemble_name = "Logistic-XGBoost"
        
#         # Make prediction
#         if ensemble is not None:
#             prediction = ensemble.predict(input_scaled)[0]
#             if hasattr(ensemble, 'predict_proba'):
#                 probability = ensemble.predict_proba(input_scaled)[0, 1]
#             else:
#                 probability = None
#         else:
#             # Use individual model consensus
#             predictions = []
#             probabilities = []
            
#             for name, model in self.individual_models.items():
#                 try:
#                     pred = model.predict(input_scaled)[0]
#                     predictions.append(pred)
                    
#                     if hasattr(model, 'predict_proba'):
#                         prob = model.predict_proba(input_scaled)[0, 1]
#                         probabilities.append(prob)
#                 except Exception as e:
#                     print(f"Error with {name}: {e}")
#                     continue
            
#             if predictions:
#                 prediction = int(np.mean(predictions) > 0.5)
#                 probability = np.mean(probabilities) if probabilities else None
#             else:
#                 raise ValueError("No models available for prediction")
        
#         # Determine confidence
#         if probability is not None:
#             confidence_score = abs(probability - 0.5) * 2  # 0 to 1 scale
#             if confidence_score < 0.3:
#                 confidence = "Low"
#             elif confidence_score < 0.7:
#                 confidence = "Medium"
#             else:
#                 confidence = "High"
#         else:
#             confidence = "Unknown"
        
#         return {
#             'prediction': prediction,
#             'prediction_label': 'Ready' if prediction == 1 else 'Not Ready',
#             'probability': probability,
#             'confidence': confidence,
#             'ensemble_used': ensemble_name
#         }
    
#     def get_model_consensus(self, patient_data):
#         """Get predictions from all individual models"""
#         input_scaled = self._prepare_input(patient_data)
        
#         consensus = {}
#         for name, model in self.individual_models.items():
#             try:
#                 pred = model.predict(input_scaled)[0]
#                 prob = None
#                 if hasattr(model, 'predict_proba'):
#                     prob = model.predict_proba(input_scaled)[0, 1]
                
#                 consensus[name] = {
#                     'prediction': pred,
#                     'probability': prob
#                 }
#             except Exception as e:
#                 print(f"Error getting consensus from {name}: {e}")
#                 continue
        
#         return consensus
    
#     def get_top_features(self, patient_dict, top_k=3):
#         """
#         Get top features influencing the prediction
#         """
#         input_scaled = self._prepare_input(patient_dict)
        
#         # Try to find a model with feature importance
#         model_with_importance = None
#         for name, model in self.individual_models.items():
#             if hasattr(model, 'feature_importances_'):
#                 model_with_importance = model
#                 break
        
#         # Try ensembles if no individual model has importance
#         if model_with_importance is None:
#             for ensemble in [self.custom_ensemble, self.sklearn_ensemble]:
#                 if ensemble is not None and hasattr(ensemble, 'feature_importances_'):
#                     model_with_importance = ensemble
#                     break
        
#         if model_with_importance is None:
#             # Fallback: return features with highest absolute values
#             feature_values = [(feat, abs(val)) for feat, val in 
#                             zip(self.features, input_scaled[0])]
#             feature_values.sort(key=lambda x: x[1], reverse=True)
#             return [feat for feat, _ in feature_values[:top_k]]
        
#         # Use feature importance
#         importances = model_with_importance.feature_importances_
#         contributions = np.abs(importances * input_scaled[0])
        
#         top_indices = np.argsort(contributions)[::-1][:top_k]
#         top_features = [self.features[i] for i in top_indices]
        
#         return top_features

# # Utility functions for backward compatibility
# def load_robust_predictor():
#     """Load the robust predictor from pickle file"""
#     try:
#         with open("robust_icu_predictor.pkl", "rb") as f:
#             return pickle.load(f)
#     except Exception as e:
#         print(f"Error loading robust predictor: {e}")
#         return RobustICUPredictor()

# def save_robust_predictor(predictor):
#     """Save the robust predictor to pickle file"""
#     try:
#         with open("robust_icu_predictor.pkl", "wb") as f:
#             pickle.dump(predictor, f)
#         print("✓ Robust predictor saved successfully")
#     except Exception as e:
#         print(f"Error saving robust predictor: {e}")
# robust_predictor.py - Fixed version
import numpy as np
import pandas as pd
import pickle
import joblib
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.ensemble import VotingClassifier
import os

class CustomEnsemble(BaseEstimator, ClassifierMixin):
    """Custom ensemble that handles XGBoost and sklearn models together"""
    
    def __init__(self, models_dict):
        self.models = models_dict
        self.model_names = list(models_dict.keys())
        self.is_fitted = False
        
    def fit(self, X, y):
        # Models are already fitted in our case
        self.is_fitted = True
        return self
        
    def predict(self, X):
        """Majority voting prediction"""
        if not self.is_fitted:
            raise ValueError("Ensemble must be fitted before prediction")
            
        predictions = []
        for name, model in self.models.items():
            pred = model.predict(X)
            predictions.append(pred)
        
        # Majority voting
        predictions = np.array(predictions)
        final_pred = np.apply_along_axis(
            lambda x: np.bincount(x).argmax(), 
            axis=0, 
            arr=predictions
        )
        return final_pred
        
    def predict_proba(self, X):
        """Average probability prediction"""
        if not self.is_fitted:
            raise ValueError("Ensemble must be fitted before prediction")
            
        probabilities = []
        for name, model in self.models.items():
            if hasattr(model, 'predict_proba'):
                prob = model.predict_proba(X)[:, 1]
            else:
                # For models without predict_proba, use predictions as probabilities
                pred = model.predict(X)
                prob = pred.astype(float)
            probabilities.append(prob)
        
        # Average probabilities
        avg_prob = np.mean(probabilities, axis=0)
        # Convert to proper probability format
        proba_matrix = np.column_stack([1 - avg_prob, avg_prob])
        return proba_matrix
    
    @property
    def feature_importances_(self):
        """Get average feature importances from models that support it"""
        importances = []
        for model in self.models.values():
            if hasattr(model, 'feature_importances_'):
                importances.append(model.feature_importances_)
        
        if not importances:
            raise AttributeError("None of the models have feature_importances_")
        
        return np.mean(importances, axis=0)

class RobustICUPredictor:
    """
    Robust ICU Transfer Readiness Predictor with multiple ensemble options
    and comprehensive error handling
    """
    
    def __init__(self,model_dir="models"):
        self.model_dir = model_dir
        # Ensemble models
        self.sklearn_ensemble = None
        self.custom_ensemble = None
        self.logistic_xgb_ensemble = None
        
        # Individual models
        self.individual_models = {}
        
        # Preprocessing
        self.scaler = None
        self.imputer = None
        self.features = []
        
        # Availability flags
        self.has_sklearn_ensemble = False
        self.has_custom_ensemble = False
        self.has_logistic_xgb = False
        
        # Try to load everything
        self._load_components()
        
    def _load_components(self):
        """Load all available model components"""
        try:
            self.scaler = joblib.load(os.path.join(self.model_dir, "robust_scaler.pkl"))
            self.imputer = joblib.load(os.path.join(self.model_dir,"knn_imputer.pkl"))
            print("✓ Preprocessing components loaded")
        except Exception as e:
            print(f"⚠ Could not load preprocessing objects: {e}")
            
        # Load sklearn ensemble
        try:
            self.sklearn_ensemble = joblib.load(os.path.join(self.model_dir,"sklearn_ensemble.pkl"))
            self.has_sklearn_ensemble = True
            print("✓ Scikit-learn ensemble loaded")
        except Exception as e:
            print(f"⚠ Scikit-learn ensemble not available: {e}")
            
        # Load individual models first
        self._load_individual_models()
        
        # Try to recreate custom ensembles from individual models
        self._recreate_custom_ensembles()
            
        # Load features from training results
        try:
            import json
            with open(os.path.join(self.model_dir, "comprehensive_training_results.json"), "r") as f:
                results = json.load(f)
                self.features = results["training_info"]["features"]
            print(f"✓ Feature list loaded: {len(self.features)} features")
        except Exception as e:
            print(f"⚠ Could not load feature list: {e}")
            # Fallback feature list based on your data
            self.features = [
                'HR', 'SpO2', 'RESP', 'ABPsys', 'lactate', 'gcs', 
                'age', 'comorbidity_score', 'on_vent', 'on_pressors'
            ]
            print(f"✓ Using fallback feature list: {self.features}")
    
    def _load_individual_models(self):
        """Load all individual models"""
        model_files = [
            "model_logistic_l1.pkl",
            "model_logistic_l2.pkl", 
            "model_logistic_elastic.pkl",
            "model_random_forest.pkl",
            "model_extra_trees.pkl",
            "model_gradient_boost.pkl",
            "model_xgboost.pkl",
            "model_xgboost_balanced.pkl",
            "model_svm_rbf.pkl",
            "model_svm_linear.pkl",
            "model_naive_bayes.pkl",
            "model_knn.pkl",
            "model_decision_tree.pkl"
        ]
        
        for model_file in model_files:
            try:
                model_name = model_file.replace("model_", "").replace(".pkl", "")
                model_path = os.path.join(self.model_dir, model_file)
                self.individual_models[model_name] = joblib.load(model_path)
                print(f"✓ {model_name} loaded")
            except Exception as e:
                continue
        
        print(f"✓ {len(self.individual_models)} individual models loaded")
    
    def _recreate_custom_ensembles(self):
        """Recreate custom ensembles from individual models"""
        if not self.individual_models:
            print("⚠ No individual models available to create custom ensembles")
            return
        
        try:
            # Create custom ensemble with all models
            self.custom_ensemble = CustomEnsemble(self.individual_models.copy())
            self.custom_ensemble.fit(None, None)  # Mark as fitted
            self.has_custom_ensemble = True
            print("✓ Custom ensemble recreated from individual models")
        except Exception as e:
            print(f"⚠ Could not recreate custom ensemble: {e}")
        
        try:
            # Create logistic-xgb ensemble with specific models
            logistic_xgb_models = {}
            if 'logistic_l2' in self.individual_models:
                logistic_xgb_models['logistic_l2'] = self.individual_models['logistic_l2']
            if 'xgboost' in self.individual_models:
                logistic_xgb_models['xgboost'] = self.individual_models['xgboost']
            
            if len(logistic_xgb_models) >= 2:
                self.logistic_xgb_ensemble = CustomEnsemble(logistic_xgb_models)
                self.logistic_xgb_ensemble.fit(None, None)  # Mark as fitted
                self.has_logistic_xgb = True
                print("✓ Logistic-XGBoost ensemble recreated")
            else:
                print("⚠ Not enough models for logistic-xgb ensemble")
        except Exception as e:
            print(f"⚠ Could not recreate logistic-xgb ensemble: {e}")
    
    def _prepare_input(self, patient_data):
        """Prepare patient data for prediction"""
        if self.scaler is None or self.imputer is None:
            raise ValueError("Preprocessing objects not available")
            
        # Create input array in correct feature order
        input_array = []
        for feature in self.features:
            value = patient_data.get(feature, np.nan)
            input_array.append(value)
        
        # Convert to numpy array and preprocess
        input_data = np.array([input_array])
        input_imputed = self.imputer.transform(input_data)
        input_scaled = self.scaler.transform(input_imputed)
        
        return input_scaled
    
    def predict_dict(self, patient_data, ensemble_type='best'):
        """
        Predict transfer readiness with detailed results.

        Args:
            patient_data: Dict with patient features
            ensemble_type: 'best', 'custom', 'sklearn', 'logistic_xgb', or 'individual'

        Returns:
            Dict with prediction, probability, confidence, etc.
        """
        print("\n🩺 Received patient input:", patient_data)
        print("🔧 Requested ensemble type:", ensemble_type)

        input_scaled = self._prepare_input(patient_data)

        ensemble = None
        ensemble_name = "Individual models"

        # --- Select ensemble ---
        if ensemble_type == 'best':
            if self.has_custom_ensemble:
                ensemble = self.custom_ensemble
                ensemble_name = "Custom (All Models)"
            elif self.has_logistic_xgb:
                ensemble = self.logistic_xgb_ensemble
                ensemble_name = "Logistic-XGBoost"
            elif self.has_sklearn_ensemble:
                ensemble = self.sklearn_ensemble
                ensemble_name = "Scikit-learn"
        elif ensemble_type == 'custom' and self.has_custom_ensemble:
            ensemble = self.custom_ensemble
            ensemble_name = "Custom (All Models)"
        elif ensemble_type == 'sklearn' and self.has_sklearn_ensemble:
            ensemble = self.sklearn_ensemble
            ensemble_name = "Scikit-learn"
        elif ensemble_type == 'logistic_xgb' and self.has_logistic_xgb:
            ensemble = self.logistic_xgb_ensemble
            ensemble_name = "Logistic-XGBoost"

        # --- Run prediction ---
        try:
            if ensemble is not None:
                prediction = int(ensemble.predict(input_scaled)[0])
                probability = float(ensemble.predict_proba(input_scaled)[0, 1]) if hasattr(ensemble, 'predict_proba') else None
            else:
                # Use individual model consensus
                predictions = []
                probabilities = []

                for name, model in self.individual_models.items():
                    try:
                        pred = model.predict(input_scaled)[0]
                        predictions.append(pred)
                        if hasattr(model, 'predict_proba'):
                            probabilities.append(model.predict_proba(input_scaled)[0, 1])
                    except Exception as e:
                        print(f"❌ Error in model '{name}':", e)

                if not predictions:
                    raise ValueError("No models available for prediction")

                prediction = int(np.mean(predictions) > 0.5)
                probability = float(np.mean(probabilities)) if probabilities else None

        except Exception as e:
            print("❌ Prediction error:", e)
            raise

        # --- Confidence ---
        if probability is not None:
            confidence_score = abs(probability - 0.5) * 2
            confidence = (
                "Low" if confidence_score < 0.3 else
                "Medium" if confidence_score < 0.7 else
                "High"
            )
        else:
            confidence = "Unknown"

        # --- Logging results ---
        print("✅ Final Prediction:", prediction)
        print("📊 Probability:", probability)
        print("🎯 Confidence:", confidence)
        print("🤖 Ensemble Used:", ensemble_name)

        return {
            'prediction': prediction,
            'prediction_label': 'Ready' if prediction == 1 else 'Not Ready',
            'probability': probability,
            'confidence': confidence,
            'ensemble_used': ensemble_name
        }

    def get_model_consensus(self, patient_data):
        """Get predictions from all individual models"""
        input_scaled = self._prepare_input(patient_data)
        
        consensus = {}
        for name, model in self.individual_models.items():
            try:
                pred = model.predict(input_scaled)[0]
                prob = None
                if hasattr(model, 'predict_proba'):
                    prob = model.predict_proba(input_scaled)[0, 1]
                
                consensus[name] = {
                    'prediction': pred,
                    'probability': prob
                }
            except Exception as e:
                print(f"Error getting consensus from {name}: {e}")
                continue
        
        return consensus
    
    def get_top_features(self, patient_dict, top_k=3):
        """
        Get top features influencing the prediction
        """
        input_scaled = self._prepare_input(patient_dict)
        
        # Try to find a model with feature importance
        model_with_importance = None
        for name, model in self.individual_models.items():
            if hasattr(model, 'feature_importances_'):
                model_with_importance = model
                break
        
        # Try ensembles if no individual model has importance
        if model_with_importance is None:
            for ensemble in [self.custom_ensemble, self.sklearn_ensemble]:
                if ensemble is not None and hasattr(ensemble, 'feature_importances_'):
                    model_with_importance = ensemble
                    break
        
        if model_with_importance is None:
            # Fallback: return features with highest absolute values
            feature_values = [(feat, abs(val)) for feat, val in 
                            zip(self.features, input_scaled[0])]
            feature_values.sort(key=lambda x: x[1], reverse=True)
            return [feat for feat, _ in feature_values[:top_k]]
        
        # Use feature importance
        importances = model_with_importance.feature_importances_
        contributions = np.abs(importances * input_scaled[0])
        
        top_indices = np.argsort(contributions)[::-1][:top_k]
        top_features = [self.features[i] for i in top_indices]
        
        return top_features

# Utility functions for backward compatibility
def load_robust_predictor():
    """Load the robust predictor from pickle file"""
    try:
        with open("robust_icu_predictor.pkl", "rb") as f:
            return pickle.load(f)
    except Exception as e:
        print(f"Error loading robust predictor: {e}")
        return RobustICUPredictor()

def save_robust_predictor(predictor):
    """Save the robust predictor to pickle file"""
    try:
        with open("robust_icu_predictor.pkl", "wb") as f:
            pickle.dump(predictor, f)
        print("✓ Robust predictor saved successfully")
    except Exception as e:
        print(f"Error saving robust predictor: {e}")

def load_model():
    """Load and return a fully-initialized RobustICUPredictor."""
    model = RobustICUPredictor()
    model._load_components()
    return model
def predict(self, X):
    if self.has_custom_ensemble and self.custom_ensemble is not None:
        return self.custom_ensemble.predict(X)
    elif self.has_logistic_xgb and self.logistic_xgb_ensemble is not None:
        return self.logistic_xgb_ensemble.predict(X)
    elif self.has_sklearn_ensemble and self.sklearn_ensemble is not None:
        return self.sklearn_ensemble.predict(X)
    else:
        raise ValueError("No valid ensemble available for prediction.")

def predict_proba(self, X):
    if self.has_custom_ensemble and self.custom_ensemble is not None:
        return self.custom_ensemble.predict_proba(X)
    elif self.has_logistic_xgb and self.logistic_xgb_ensemble is not None:
        return self.logistic_xgb_ensemble.predict_proba(X)
    elif self.has_sklearn_ensemble and self.sklearn_ensemble is not None:
        return self.sklearn_ensemble.predict_proba(X)
    else:
        raise ValueError("No valid ensemble available for probability prediction.")
