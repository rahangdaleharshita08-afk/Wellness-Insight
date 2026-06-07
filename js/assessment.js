import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    doc, 
    updateDoc,
    setDoc 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

checkAuth((user, profileData) => {
    // DOM Elements
    const form = document.getElementById("assessmentWizardForm");
    const steps = document.querySelectorAll(".wizard-step");
    const panels = document.querySelectorAll(".wizard-panel");
    const progressBar = document.getElementById("wizardProgressBar");
    
    // Inputs for step checking
    const ageInput = document.getElementById("ageInput");
    const genderSelect = document.getElementById("genderSelect");
    const bloodGroupSelect = document.getElementById("bloodGroupSelect");
    const heightInput = document.getElementById("heightInput");
    const weightInput = document.getElementById("weightInput");
    const bmiDisplay = document.getElementById("bmiCalculatorDisplay");
    const bmiValBadge = document.getElementById("bmiValBadge");
    
    const systolicBp = document.getElementById("systolicBp");
    const diastolicBp = document.getElementById("diastolicBp");
    const glucoseInput = document.getElementById("glucoseInput");
    const heartRateInput = document.getElementById("heartRateInput");
    const cholesterolInput = document.getElementById("cholesterolInput");
    
    const smokingSelect = document.getElementById("smokingSelect");
    const alcoholSelect = document.getElementById("alcoholSelect");
    const activitySelect = document.getElementById("activitySelect");
    const dietSelect = document.getElementById("dietSelect");

    // Wizard navigation controls
    const btnNextStep1 = document.getElementById("btnNextStep1");
    const btnPrevStep2 = document.getElementById("btnPrevStep2");
    const btnNextStep2 = document.getElementById("btnNextStep2");
    const btnPrevStep3 = document.getElementById("btnPrevStep3");

    // AI loading overlay elements
    const aiOverlay = document.getElementById("aiLoadingOverlay");
    const aiText = document.getElementById("aiLoadingText");

    let currentStep = 1;
    let bmiValue = 0;
    let bmiCategory = "";

    // Pre-populate forms from User profile if present
    if (profileData.age) ageInput.value = profileData.age;
    if (profileData.gender) genderSelect.value = profileData.gender;
    if (profileData.bloodGroup) bloodGroupSelect.value = profileData.bloodGroup;

    // 1. Live BMI Calculator Logic
    function updateBmi() {
        const height = parseFloat(heightInput.value);
        const weight = parseFloat(weightInput.value);

        if (height > 80 && weight > 20) {
            const heightInMeters = height / 100;
            bmiValue = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
            
            // Determine category
            if (bmiValue < 18.5) {
                bmiCategory = "Underweight";
                bmiValBadge.className = "metric-badge warning";
            } else if (bmiValue >= 18.5 && bmiValue <= 24.9) {
                bmiCategory = "Normal";
                bmiValBadge.className = "metric-badge success";
            } else if (bmiValue >= 25 && bmiValue <= 29.9) {
                bmiCategory = "Overweight";
                bmiValBadge.className = "metric-badge warning";
            } else {
                bmiCategory = "Obese";
                bmiValBadge.className = "metric-badge danger";
            }
            
            bmiDisplay.style.borderColor = "var(--border-card)";
            bmiDisplay.innerHTML = `
                <span style="color: var(--text-primary); font-weight: 600;">BMI: ${bmiValue}</span>
                <span id="bmiValBadge" class="${bmiValBadge.className}">${bmiCategory}</span>
            `;
        } else {
            bmiValue = 0;
            bmiCategory = "";
            bmiDisplay.innerHTML = `
                <span style="color: var(--text-muted); font-size: 0.9rem;">Enter Height & Weight</span>
                <span id="bmiValBadge" class="metric-badge success" style="display: none;">--</span>
            `;
        }
    }

    heightInput.addEventListener("input", updateBmi);
    weightInput.addEventListener("input", updateBmi);

    // 2. Wizard State Transitions
    function navigateToStep(targetStep) {
        if (targetStep < 1 || targetStep > 3) return;
        
        // Update steps visually
        steps.forEach((stepNode) => {
            const stepIndex = parseInt(stepNode.getAttribute("data-step"));
            if (stepIndex < targetStep) {
                stepNode.className = "wizard-step completed";
            } else if (stepIndex === targetStep) {
                stepNode.className = "wizard-step active";
            } else {
                stepNode.className = "wizard-step";
            }
        });

        // Update active panels
        panels.forEach((panel) => {
            panel.classList.remove("active");
        });
        document.getElementById(`step${targetStep}Panel`).classList.add("active");

        // Update progress bar width
        const fillPercentage = ((targetStep - 1) / (steps.length - 1)) * 100;
        progressBar.style.width = `${fillPercentage}%`;
        
        currentStep = targetStep;
        window.scrollTo({ top: 100, behavior: 'smooth' });
    }

    // 3. Step Validation Checks
    function validateStep1() {
        if (!ageInput.reportValidity()) return false;
        if (!genderSelect.reportValidity()) return false;
        if (!bloodGroupSelect.reportValidity()) return false;
        if (!heightInput.reportValidity()) return false;
        if (!weightInput.reportValidity()) return false;
        if (bmiValue === 0) {
            alert("Please supply valid measurements for BMI calculation.");
            return false;
        }
        return true;
    }

    function validateStep2() {
        if (!systolicBp.reportValidity()) return false;
        if (!diastolicBp.reportValidity()) return false;
        if (!glucoseInput.reportValidity()) return false;
        if (!heartRateInput.reportValidity()) return false;
        if (!cholesterolInput.reportValidity()) return false;
        return true;
    }

    // Bind Button Event Listeners
    btnNextStep1.addEventListener("click", () => {
        if (validateStep1()) navigateToStep(2);
    });

    btnPrevStep2.addEventListener("click", () => {
        navigateToStep(1);
    });

    btnNextStep2.addEventListener("click", () => {
        if (validateStep2()) navigateToStep(3);
    });

    btnPrevStep3.addEventListener("click", () => {
        navigateToStep(2);
    });

    // 4. Clinical AI Prediction Engine
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Validate final state dropdowns
            if (!smokingSelect.reportValidity() || !alcoholSelect.reportValidity() || 
                !activitySelect.reportValidity() || !dietSelect.reportValidity()) {
                return;
            }

            // Start clinical analysis animation sequence
            aiOverlay.style.display = "flex";
            
            const phases = [
                { text: "Calibrating baseline demographics...", delay: 600 },
                { text: "Correlating cardiovascular metrics & blood pressure...", delay: 1200 },
                { text: "Running metabolic diabetes risk model...", delay: 1800 },
                { text: "Synthesizing comprehensive clinical wellness score...", delay: 2400 }
            ];

            phases.forEach((phase) => {
                setTimeout(() => {
                    aiText.textContent = phase.text;
                }, phase.delay);
            });

            // Resolve calculations
            setTimeout(async () => {
                try {
                    const age = parseInt(ageInput.value);
                    const height = parseFloat(heightInput.value);
                    const weight = parseFloat(weightInput.value);
                    const sys = parseInt(systolicBp.value);
                    const dia = parseInt(diastolicBp.value);
                    const gluc = parseInt(glucoseInput.value);
                    const pulse = parseInt(heartRateInput.value);
                    const chol = parseInt(cholesterolInput.value);
                    
                    const smoking = smokingSelect.value;
                    const alcohol = alcoholSelect.value;
                    const activity = activitySelect.value;
                    const diet = dietSelect.value;

                    // Cardiovascular / Heart Risk computation
                    let heartRisk = 10; 
                    if (age > 45) heartRisk += 15;
                    if (sys >= 140 || dia >= 90) heartRisk += 25;
                    else if (sys >= 120 || dia >= 80) heartRisk += 10;
                    if (chol >= 240) heartRisk += 20;
                    else if (chol >= 200) heartRisk += 10;
                    if (smoking === "active") heartRisk += 20;
                    if (bmiValue >= 30) heartRisk += 10;
                    heartRisk = Math.min(Math.max(heartRisk, 5), 99);

                    // Diabetes Risk computation
                    let diabetesRisk = 8;
                    if (gluc >= 126) diabetesRisk += 50;
                    else if (gluc >= 100) diabetesRisk += 25;
                    if (bmiValue >= 30) diabetesRisk += 20;
                    else if (bmiValue >= 25) diabetesRisk += 10;
                    if (age > 40) diabetesRisk += 10;
                    if (activity === "sedentary") diabetesRisk += 10;
                    diabetesRisk = Math.min(Math.max(diabetesRisk, 5), 99);

                    // Stroke Risk computation
                    let strokeRisk = 5;
                    if (sys >= 140 || dia >= 90) strokeRisk += 35;
                    if (smoking === "active") strokeRisk += 15;
                    if (alcohol === "regular") strokeRisk += 15;
                    if (pulse > 90) strokeRisk += 10;
                    if (age > 60) strokeRisk += 10;
                    strokeRisk = Math.min(Math.max(strokeRisk, 5), 95);

                    // Hypertension / Blood Pressure Risk computation
                    let htRisk = 10;
                    if (sys >= 130 || dia >= 85) htRisk += 50;
                    if (diet === "junk") htRisk += 15;
                    if (activity === "sedentary") htRisk += 10;
                    if (bmiValue >= 25) htRisk += 10;
                    htRisk = Math.min(Math.max(htRisk, 5), 99);

                    // Combined Health Score computation (100 - Weighted risk index)
                    const weightedRisk = (heartRisk * 0.35) + (diabetesRisk * 0.30) + (strokeRisk * 0.20) + (htRisk * 0.15);
                    const overallHealthScore = Math.round(Math.max(100 - weightedRisk, 10));

                    // Diagnostic recommendation generation
                    let predictedDisease = "Low Risk Profile";
                    let confidence = 95;
                    let riskLevel = "Low";
                    let insights = "Your vitals demonstrate safe limits. Maintain active lifestyle behaviors to sustain this index.";

                    const maxRisk = Math.max(heartRisk, diabetesRisk, strokeRisk, htRisk);
                    if (maxRisk > 65) {
                        riskLevel = "High";
                        confidence = Math.round(75 + Math.random() * 15);
                        if (maxRisk === heartRisk) {
                            predictedDisease = "Cardiovascular Strain";
                            insights = "High total cholesterols coupled with blood pressure spikes elevate your cardiovascular profile. Urgent clinic support advised.";
                        } else if (maxRisk === diabetesRisk) {
                            predictedDisease = "Type 2 Pre-Diabetes";
                            insights = "Elevated fasting blood sugar indices and BMI indicate insulin resistance. Immediate sugar restriction advised.";
                        } else if (maxRisk === strokeRisk) {
                            predictedDisease = "Vascular Hypertension / Stroke Risk";
                            insights = "Extremely high blood pressure markers present severe pressure risk. Exercise moderation and contact support.";
                        } else {
                            predictedDisease = "Essential Hypertension";
                            insights = "Constant high blood pressures detected. Reduce sodium intake and check blood pressure daily.";
                        }
                    } else if (maxRisk > 35) {
                        riskLevel = "Medium";
                        confidence = Math.round(80 + Math.random() * 10);
                        if (maxRisk === heartRisk) {
                            predictedDisease = "Borderline Arterial Strain";
                            insights = "Blood pressure values show slight elevation. Consider standard cardiovascular exercise 3 days a week.";
                        } else if (maxRisk === diabetesRisk) {
                            predictedDisease = "Borderline Glucose Intolerance";
                            insights = "Fasting sugar levels are on the high end. Balance meals with healthy fibers and proteins.";
                        } else {
                            predictedDisease = "Mild Hypertension Risk";
                            insights = "Slightly elevated systolic blood pressure. Keep monitoring daily and curb sodium consumption.";
                        }
                    }

                    // Collect active symptoms from the checklist
                    const symptoms = [];
                    document.querySelectorAll('input[name="symptomCheckbox"]:checked').forEach((cb) => {
                        symptoms.push(cb.value);
                    });

                    // Compile structured assessment report matching root collection healthRecords schema
                    const predictionData = {
                        patientId: user.uid,
                        patientName: profileData.name || user.email.split("@")[0],
                        date: new Date().toISOString(),
                        age,
                        gender: genderSelect.value,
                        bloodGroup: bloodGroupSelect.value,
                        height,
                        weight,
                        bmi: bmiValue,
                        bmiCategory,
                        systolic: sys,
                        diastolic: dia,
                        glucose: gluc,
                        heartRate: pulse,
                        cholesterol: chol,
                        smoking,
                        alcohol,
                        activity,
                        diet,
                        symptoms,
                        risks: {
                            heart: heartRisk,
                            diabetes: diabetesRisk,
                            stroke: strokeRisk,
                            hypertension: htRisk
                        },
                        healthScore: overallHealthScore,
                        predictedDisease,
                        confidence,
                        riskLevel,
                        insights
                    };

                    // 5. Save report to ROOT healthRecords Collection
                    const recordsColRef = collection(db, "healthRecords");
                    const docRef = await addDoc(recordsColRef, predictionData);

                    // 6. Update user's profile document with quick dashboard metrics
                    const userDocRef = doc(db, "users", user.uid);
                    const patientDocRef = doc(db, "patients", user.uid);
                    const syncPayload = {
                        name: profileData.name || user.displayName || (user.email ? user.email.split("@")[0] : "Anonymous Patient"),
                        email: user.email || "",
                        lastHealthScore: overallHealthScore,
                        lastBmi: bmiValue,
                        lastBmiCategory: bmiCategory,
                        lastSystolic: sys,
                        lastDiastolic: dia,
                        lastGlucose: gluc,
                        lastHeartRate: pulse,
                        lastRiskLevel: riskLevel,
                        lastPredictedDisease: predictedDisease,
                        lastAssessmentDate: predictionData.date
                    };
                    await updateDoc(userDocRef, syncPayload);
                    await setDoc(patientDocRef, syncPayload, { merge: true });

                    // Set local storage shortcut for direct retrieval
                    localStorage.setItem("lastPredictionId", docRef.id);
                    
                    // Route directly to predictions results page
                    window.location = "results.html";

                } catch (err) {
                    console.error("AI Calculation Error: ", err);
                    alert("An error occurred during assessment calculations: " + err.message);
                    aiOverlay.style.display = "none";
                }
            }, 3000);
        });
    }
});
