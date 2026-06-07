import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib

# Set random seed for reproducibility
np.random.seed(42)

def generate_synthetic_data(num_records=1500):
    """
    Generates synthetic healthcare records based on standard clinical correlations.
    """
    print(f"Generating {num_records} synthetic clinical patient logs...")
    
    age = np.random.randint(18, 85, num_records)
    gender = np.random.choice(['Male', 'Female', 'Other'], num_records)
    height = np.random.randint(150, 195, num_records) # cm
    weight = np.random.randint(45, 125, num_records) # kg
    
    # Calculate BMI
    bmi = np.round(weight / ((height / 100) ** 2), 1)
    
    systolic = np.random.randint(90, 180, num_records)
    diastolic = np.random.randint(60, 110, num_records)
    glucose = np.random.randint(70, 260, num_records)
    heart_rate = np.random.randint(55, 110, num_records)
    cholesterol = np.random.randint(130, 310, num_records)
    
    smoking = np.random.choice(['never', 'occasional', 'active'], num_records, p=[0.6, 0.25, 0.15])
    alcohol = np.random.choice(['none', 'moderate', 'regular'], num_records, p=[0.5, 0.35, 0.15])
    activity = np.random.choice(['sedentary', 'active', 'athlete'], num_records, p=[0.4, 0.45, 0.15])
    diet = np.random.choice(['vegetarian', 'balanced', 'junk'], num_records, p=[0.3, 0.5, 0.2])
    family_history = np.random.choice([0, 1], num_records, p=[0.7, 0.3]) # 0: No, 1: Yes
    
    # Create DataFrame
    df = pd.DataFrame({
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
    })
    
    # Define Target Risks using physiological formulas with random noise
    
    # 1. Obesity Risk (Mainly BMI, slightly activity and diet)
    obesity_base = (df['bmi'] - 15) * 3.5
    obesity_risk = obesity_base + (df['activity'] == 'sedentary') * 10 + (df['diet'] == 'junk') * 12 + np.random.normal(0, 3, num_records)
    df['obesity_risk'] = np.clip(obesity_risk, 5, 99).astype(int)
    
    # 2. Hypertension Risk (Systolic, Diastolic, Age, Sodium/Diet, Smoking)
    ht_base = ((df['systolic'] - 90) * 0.7) + ((df['diastolic'] - 60) * 0.6)
    ht_risk = ht_base + (df['age'] > 50) * 10 + (df['diet'] == 'junk') * 15 + (df['smoking'] == 'active') * 8 + df['family_history'] * 12 + np.random.normal(0, 4, num_records)
    df['hypertension_risk'] = np.clip(ht_risk, 5, 99).astype(int)
    
    # 3. Diabetes Risk (Glucose, BMI, Age, Sedentary, Family History)
    diab_base = (df['glucose'] - 70) * 0.4
    diab_risk = diab_base + (df['bmi'] > 28) * 18 + (df['age'] > 45) * 8 + (df['activity'] == 'sedentary') * 12 + df['family_history'] * 15 + np.random.normal(0, 4, num_records)
    df['diabetes_risk'] = np.clip(diab_risk, 5, 99).astype(int)
    
    # 4. Heart Disease Risk (Cholesterol, BP, Smoking, Age, Diabetes)
    heart_base = (df['cholesterol'] - 130) * 0.25 + (df['systolic'] - 100) * 0.4
    heart_risk = heart_base + (df['smoking'] == 'active') * 20 + (df['age'] > 55) * 12 + (df['alcohol'] == 'regular') * 8 + np.random.normal(0, 5, num_records)
    df['heart_disease_risk'] = np.clip(heart_risk, 5, 99).astype(int)
    
    # 5. Combined Overall Health Risk Score
    # Risk Score = Weighted risk average
    weighted_risk = (df['heart_disease_risk'] * 0.35) + (df['diabetes_risk'] * 0.30) + (df['hypertension_risk'] * 0.20) + (df['obesity_risk'] * 0.15)
    df['health_risk_score'] = np.round(np.clip(weighted_risk + np.random.normal(0, 2, num_records), 5, 99)).astype(int)
    
    return df

def preprocess_and_train():
    df = generate_synthetic_data(1500)
    
    # Separate Features and Targets
    feature_cols = [
        'age', 'gender', 'height', 'weight', 'bmi', 'systolic', 'diastolic', 
        'glucose', 'heart_rate', 'cholesterol', 'smoking', 'alcohol', 
        'activity', 'diet', 'family_history'
    ]
    
    target_cols = [
        'obesity_risk', 'hypertension_risk', 'diabetes_risk', 
        'heart_disease_risk', 'health_risk_score'
    ]
    
    X = df[feature_cols].copy()
    Y = df[target_cols].copy()
    
    # One-Hot Encode Categorical Columns
    categorical_cols = ['gender', 'smoking', 'alcohol', 'activity', 'diet']
    X = pd.get_dummies(X, columns=categorical_cols, drop_first=False)
    
    # Save the feature columns layout to ensure alignment in API requests
    model_features = list(X.columns)
    
    # Split into Train and Test sets
    X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, random_state=42)
    
    # Scale Features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Create directory for saving models
    os.makedirs('models', exist_ok=True)
    
    models = {}
    print("\n--- Training Random Forest Models ---")
    
    for target in target_cols:
        print(f"Training Regressor for {target}...")
        
        # Grid Search for Hyperparameter Tuning
        param_grid = {
            'n_estimators': [50, 100, 150],
            'max_depth': [6, 10, 15],
            'min_samples_split': [2, 5]
        }
        
        rf = RandomForestRegressor(random_state=42)
        grid_search = GridSearchCV(estimator=rf, param_grid=param_grid, cv=3, scoring='neg_mean_squared_error', n_jobs=-1)
        grid_search.fit(X_train_scaled, Y_train[target])
        
        best_model = grid_search.best_estimator_
        models[target] = best_model
        
        # Evaluate Regressor
        predictions = best_model.predict(X_test_scaled)
        mse = mean_squared_error(Y_test[target], predictions)
        r2 = r2_score(Y_test[target], predictions)
        print(f"[{target}] Best Params: {grid_search.best_params_}")
        print(f"[{target}] MSE: {mse:.4f} | R2-Score: {r2:.4f}")
        
        # Classification Metric Evaluation (Risk threshold > 50% treated as high/critical)
        y_test_class = (Y_test[target] > 50).astype(int)
        pred_class = (predictions > 50).astype(int)
        
        acc = accuracy_score(y_test_class, pred_class)
        prec = precision_score(y_test_class, pred_class, zero_division=0)
        rec = recall_score(y_test_class, pred_class, zero_division=0)
        f1 = f1_score(y_test_class, pred_class, zero_division=0)
        try:
            auc = roc_auc_score(y_test_class, predictions)
        except ValueError:
            auc = 0.5 # Fail-safe if only one class exists in test set
            
        print(f"[{target}] Classification Metrics (Threshold > 50%):")
        print(f"  Accuracy: {acc:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f} | ROC-AUC: {auc:.4f}\n")
        
        # Save trained model to file
        joblib.dump(best_model, f'models/{target}_rf_model.pkl')
        
    # Save the scaler and features columns layout
    joblib.dump(scaler, 'models/scaler.pkl')
    joblib.dump(model_features, 'models/model_features.pkl')
    print("All models, scalers, and layout features exported successfully to 'models/' folder.")

if __name__ == "__main__":
    preprocess_and_train()
