import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

checkAuth(async (user, profileData) => {
    // Fill sidebar credentials
    const avatarNode = document.getElementById("sidebarAvatar");
    const nameNode = document.getElementById("sidebarName");
    if (profileData.name) {
        nameNode.textContent = profileData.name;
        avatarNode.textContent = profileData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    } else if (user.email) {
        nameNode.textContent = user.email;
        avatarNode.textContent = user.email.slice(0, 2).toUpperCase();
    }

    const reportSub = document.getElementById("reportSub");
    const resultsLayout = document.getElementById("resultsLayout");

    try {
        // 1. Fetch prediction ID from local storage
        const predictionId = localStorage.getItem("lastPredictionId");
        
        if (!predictionId) {
            reportSub.textContent = "Error: No diagnostic record found.";
            return;
        }

        // 2. Query Firestore document
        const docRef = doc(db, "healthRecords", predictionId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            reportSub.textContent = "Error: Diagnostic record has expired or was removed.";
            return;
        }

        const data = docSnap.data();

        // 3. Populate Vitals & Header Info
        const rDate = new Date(data.date);
        const formattedDate = rDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
        reportSub.textContent = `WellnessInsight Diagnostic Assessment run on ${formattedDate}`;

        // Health Score Gauge Dial Rotation (-45deg to 135deg)
        const score = data.healthScore;
        const scoreDisplay = document.getElementById("resultsHealthScore");
        const scoreGaugeFill = document.getElementById("resultsGaugeFill");
        
        scoreDisplay.textContent = score;
        const rotationDegrees = -45 + (180 * score / 100);
        
        // Add subtle animation delay for gauge sweep effect
        setTimeout(() => {
            scoreGaugeFill.style.transform = `rotate(${rotationDegrees}deg)`;
        }, 100);

        // Score color changes
        if (score >= 80) {
            scoreGaugeFill.style.borderColor = "var(--color-success)";
        } else if (score >= 50) {
            scoreGaugeFill.style.borderColor = "var(--color-warning)";
        } else {
            scoreGaugeFill.style.borderColor = "var(--color-danger)";
        }

        // 4. Severity Status Banner Adjustments
        const banner = document.getElementById("resultsSeverityBanner");
        const bannerLabel = document.getElementById("resultsRiskLevelLabel");
        const bannerDesc = document.getElementById("resultsRiskLevelDesc");

        bannerLabel.textContent = `${data.riskLevel} Severity Profile`;

        if (data.riskLevel === "High") {
            banner.style.background = "var(--color-danger-bg)";
            banner.style.borderColor = "var(--color-danger)";
            banner.style.color = "var(--color-danger)";
            bannerDesc.textContent = "Elevated biological indices exceed normal ranges. Urgent clinical examination recommended.";
        } else if (data.riskLevel === "Medium") {
            banner.style.background = "var(--color-warning-bg)";
            banner.style.borderColor = "var(--color-warning)";
            banner.style.color = "var(--color-warning)";
            bannerDesc.textContent = "Mild risk vectors detected. Dietary restriction, sodium reduction, and routine lipid logs advised.";
        } else {
            banner.style.background = "var(--color-success-bg)";
            banner.style.borderColor = "var(--color-success)";
            banner.style.color = "var(--color-success)";
            bannerDesc.textContent = "Excellent biological parameters. Maintain active lifestyle choices to preserve this status.";
        }

        // 5. Populate Main Illness Prediction & Insights
        document.getElementById("resultsDiseaseName").textContent = data.predictedDisease;
        document.getElementById("resultsInsights").textContent = data.insights;
        document.getElementById("resultsConfidence").textContent = `${data.confidence}%`;

        // 6. Draw Individual Progress bars
        document.getElementById("riskHeartVal").textContent = `${data.risks.heart}%`;
        document.getElementById("riskHeartBar").style.width = `${data.risks.heart}%`;

        document.getElementById("riskDiabetesVal").textContent = `${data.risks.diabetes}%`;
        document.getElementById("riskDiabetesBar").style.width = `${data.risks.diabetes}%`;

        document.getElementById("riskStrokeVal").textContent = `${data.risks.stroke}%`;
        document.getElementById("riskStrokeBar").style.width = `${data.risks.stroke}%`;

        document.getElementById("riskHypertensionVal").textContent = `${data.risks.hypertension}%`;
        document.getElementById("riskHypertensionBar").style.width = `${data.risks.hypertension}%`;

        // 7. Compile Recommendation checklists
        const dietList = document.getElementById("dietList");
        const exerciseList = document.getElementById("exerciseList");
        const clinicalList = document.getElementById("clinicalList");

        // Diet Checklist Items
        const dietActions = [];
        if (data.glucose >= 100) {
            dietActions.push("Substitute high glycemic foods for fresh oats/legumes.");
            dietActions.push("Adopt sugar-free diets and restrict soda drinks.");
        }
        if (data.systolic >= 120 || data.diastolic >= 80) {
            dietActions.push("Restrict cooking salt and avoid canned foods.");
            dietActions.push("Increase potassium via fresh leafy greens and bananas.");
        }
        dietActions.push("Consume at least 3 liters of fresh drinking water daily.");
        dietActions.push("Include clean fatty acids like avocado and nuts.");
        
        dietList.innerHTML = dietActions.map(action => `
            <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: var(--text-secondary);">
                <i class="fa-regular fa-square-check" style="color: var(--color-primary); margin-top: 3px;"></i>
                <span>${action}</span>
            </div>
        `).join("");

        // Physical Checklist Items
        const exerciseActions = [];
        if (data.bmi >= 25) {
            exerciseActions.push("Aim for 45 minutes brisk cardio pacing 4 days weekly.");
            exerciseActions.push("Integrate light compound weight lifting routines.");
        } else {
            exerciseActions.push("Aim for 30 minutes moderate physical drills daily.");
        }
        exerciseActions.push("Maintain posture breaks after 45 minutes of desk sits.");
        exerciseActions.push("Track morning and resting pulse targets (60-80 bpm).");
        
        exerciseList.innerHTML = exerciseActions.map(action => `
            <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: var(--text-secondary);">
                <i class="fa-regular fa-square-check" style="color: var(--color-secondary); margin-top: 3px;"></i>
                <span>${action}</span>
            </div>
        `).join("");

        // Outpatient Checklist Items
        const clinicalActions = [];
        if (data.riskLevel === "High") {
            clinicalActions.push("Schedule primary practitioner visit within 72 hours.");
            clinicalActions.push("Bring printed copy of this diagnostic score document.");
            clinicalActions.push("Establish routine home blood pressure logs twice daily.");
        } else if (data.riskLevel === "Medium") {
            clinicalActions.push("Request bi-annual wellness lipid panel testing.");
            clinicalActions.push("Discuss biometric ranges with certified dietician.");
        } else {
            clinicalActions.push("Conduct routine comprehensive medical panels annually.");
        }
        clinicalActions.push("Assess overall lifestyle stress levels and target 8h sleep.");
        
        clinicalList.innerHTML = clinicalActions.map(action => `
            <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: var(--text-secondary);">
                <i class="fa-regular fa-square-check" style="color: var(--color-accent); margin-top: 3px;"></i>
                <span>${action}</span>
            </div>
        `).join("");

        // 8. Bind PDF Printing Actions
        document.getElementById("btnPrintReport").addEventListener("click", () => {
            window.print();
        });

    } catch (err) {
        console.error("Diagnostic Report Load Error: ", err);
        resultsLayout.innerHTML = `
            <div class="glass-card" style="grid-column: span 2; text-align: center; padding: 40px; color: var(--color-danger);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px;"></i>
                <h4>Unable to Load Report</h4>
                <p style="color: var(--text-secondary); margin-top: 10px;">${err.message}</p>
            </div>
        `;
    }
});
