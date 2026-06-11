import os
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Find models directory robustly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')
if not os.path.exists(MODELS_DIR):
    # Try looking in the parent directory (workspace root)
    MODELS_DIR = os.path.join(os.path.dirname(BASE_DIR), 'models')

print(f"Loading models from: {MODELS_DIR}")

# Load models and scaling artifacts
try:
    scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
    model_features = joblib.load(os.path.join(MODELS_DIR, 'model_features.pkl'))
    
    models = {
        'obesity_risk': joblib.load(os.path.join(MODELS_DIR, 'obesity_risk_rf_model.pkl')),
        'hypertension_risk': joblib.load(os.path.join(MODELS_DIR, 'hypertension_risk_rf_model.pkl')),
        'diabetes_risk': joblib.load(os.path.join(MODELS_DIR, 'diabetes_risk_rf_model.pkl')),
        'heart_disease_risk': joblib.load(os.path.join(MODELS_DIR, 'heart_disease_risk_rf_model.pkl')),
        'health_risk_score': joblib.load(os.path.join(MODELS_DIR, 'health_risk_score_rf_model.pkl'))
    }
    print("All ML models and preprocessors loaded successfully.")
except Exception as e:
    print(f"ERROR: Failed to load models: {str(e)}")
    scaler = None
    model_features = None
    models = {}

@app.route('/health', methods=['GET'])
def health_check():
    if not models or not scaler:
        return jsonify({"status": "unhealthy", "error": "Models or scaler not loaded"}), 500
    return jsonify({"status": "healthy", "model_features_count": len(model_features)}), 200

@app.route('/predict', methods=['POST'])
def predict():
    if not models or not scaler:
        return jsonify({"error": "Model service is currently offline or uninitialized"}), 503
        
    try:
        data = request.get_json(force=True)
        
        # 1. Validation and Extraction
        required_fields = [
            'age', 'gender', 'height', 'weight', 'systolic', 'diastolic', 
            'glucose', 'heart_rate', 'cholesterol', 'smoking', 'alcohol', 
            'activity', 'diet', 'family_history'
        ]
        
        missing = [f for f in required_fields if f not in data]
        if missing:
            return jsonify({"error": f"Missing required parameters: {', '.join(missing)}"}), 400
            
        # Extract features
        age = int(data['age'])
        gender = str(data['gender'])
        height = float(data['height'])
        weight = float(data['weight'])
        systolic = int(data['systolic'])
        diastolic = int(data['diastolic'])
        glucose = int(data['glucose'])
        heart_rate = int(data['heart_rate'])
        cholesterol = int(data['cholesterol'])
        smoking = str(data['smoking'])
        alcohol = str(data['alcohol'])
        activity = str(data['activity'])
        diet = str(data['diet'])
        family_history = int(data['family_history'])
        
        # Calculate BMI
        bmi = round(weight / ((height / 100) ** 2), 1)
        
        # Determine BMI category
        if bmi < 18.5:
            bmi_category = "Underweight"
        elif bmi <= 24.9:
            bmi_category = "Normal"
        elif bmi <= 29.9:
            bmi_category = "Overweight"
        else:
            bmi_category = "Obese"
            
        # 2. Preprocessing & Alignment with Training features layout
        input_data = pd.DataFrame([{
            'age': age,
            'gender': gender,
            'height': height,
            'weight': weight,
            'bmi': bmi,
            'systolic': systolic,
            'diastolic': diastolic,
            'glucose': glucose,
            'heart_rate': heart_rate,
            'cholesterol': cholesterol,
            'smoking': smoking,
            'alcohol': alcohol,
            'activity': activity,
            'diet': diet,
            'family_history': family_history
        }])
        
        # One-Hot Encode
        categorical_cols = ['gender', 'smoking', 'alcohol', 'activity', 'diet']
        input_encoded = pd.get_dummies(input_data, columns=categorical_cols)
        
        # Re-index columns with layout features, filling missing dummy columns with 0
        for col in model_features:
            if col not in input_encoded.columns:
                input_encoded[col] = 0
        input_aligned = input_encoded[model_features]
        
        # Scale Input
        input_scaled = scaler.transform(input_aligned)
        
        # 3. Model Predictions
        preds = {}
        for target, model in models.items():
            preds[target] = int(np.clip(model.predict(input_scaled)[0], 5, 99))
            
        # 4. Risk Classification based on Overall Health Risk Score
        risk_score = preds['health_risk_score']
        if risk_score < 25:
            risk_level = "Low"
        elif risk_score < 50:
            risk_level = "Moderate"
        elif risk_score < 75:
            risk_level = "High"
        else:
            risk_level = "Critical"
            
        # Combined Health Score (matching existing frontend display: 100 - risk_score)
        health_score = 100 - risk_score
        
        # 5. Generate Personalized Recommendations and Insights
        recommendations = []
        insights = "Your vitals demonstrate safe limits. Maintain active lifestyle behaviors to sustain this index."
        
        if preds['diabetes_risk'] >= 50:
            recommendations.append("Sugar Restricting: Minimize refined sugar, beverages, and simple starches to control glycemic levels.")
            insights = "Elevated glucose levels indicate high risk of insulin resistance. Focus on reducing carbohydrates."
            
        if preds['hypertension_risk'] >= 50:
            recommendations.append("Sodium Restricting: Curb daily sodium to less than 2,000mg. Substitute salt with spices.")
            insights = "Arterial pressure spikes indicate high vascular hypertension. Track blood pressure daily."
            
        if preds['heart_disease_risk'] >= 50:
            recommendations.append("Standard Diagnostics: Schedule a comprehensive clinical annual blood lipid and cholesterol panel.")
            insights = "Spikes in cholesterol and arterial pressure elevate cardiovascular strain risk."
            
        if preds['obesity_risk'] >= 50:
            recommendations.append("Weight Management: Shift food layouts to higher protein/fiber ratios and track calorie intakes.")
            
        if smoking in ['active', 'occasional']:
            recommendations.append("Nicotine Stopping: Contact clinical cessation specialists. Quitting immediately drops coronary risks by 50%.")
            
        if activity == 'sedentary':
            recommendations.append("Physical Vitals: Accumulate at least 150 minutes of moderate aerobic exercises weekly.")
            
        if not recommendations:
            recommendations.append("Standard Diagnostics: Keep up the excellent work! Continue standard clinical lipid checkups annually.")

        # Compile response JSON matching the database schemas
        response = {
            "age": age,
            "gender": gender,
            "height": height,
            "weight": weight,
            "bmi": bmi,
            "bmiCategory": bmi_category,
            "systolic": systolic,
            "diastolic": diastolic,
            "glucose": glucose,
            "heartRate": heart_rate,
            "cholesterol": cholesterol,
            "smoking": smoking,
            "alcohol": alcohol,
            "activity": activity,
            "diet": diet,
            "familyHistory": family_history,
            "risks": {
                "heart": preds['heart_disease_risk'],
                "diabetes": preds['diabetes_risk'],
                "stroke": preds['health_risk_score'], # Stroke maps to overall health risk average in this context
                "hypertension": preds['hypertension_risk'],
                "obesity": preds['obesity_risk']
            },
            "healthScore": health_score,
            "overallRiskScore": risk_score,
            "predictedDisease": "Cardiovascular Strain" if preds['heart_disease_risk'] > 60 else "Type 2 Diabetes" if preds['diabetes_risk'] > 60 else "Essential Hypertension" if preds['hypertension_risk'] > 60 else "Low Risk Profile",
            "confidence": 95 if risk_level == "Low" else 88 if risk_level == "Moderate" else 82,
            "riskLevel": risk_level,
            "insights": insights,
            "recommendations": recommendations
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Prediction server error: {str(e)}"}), 500

if __name__ == '__main__':
    # Start on port 5001 to prevent conflicts with standard React/Server port
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=5001, debug=True)
