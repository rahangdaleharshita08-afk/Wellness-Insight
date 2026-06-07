import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    orderBy,
    where,
    addDoc,
    doc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

checkAuth(async (user, profileData) => {
    // State management for instant localization
    let localLatest = null;
    let localPredictions = null;

    // 1. Greet User
    const nameNode = document.getElementById("sidebarName");
    const avatarNode = document.getElementById("sidebarAvatar");
    const greetingNode = document.getElementById("welcomeUserGreeting");
    
    function greetUser() {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        const welcomeText = window.i18n ? window.i18n.translateText("welcome_back_greeting", activeLang) : "Welcome Back";
        let firstName = "User";
        if (profileData.name) {
            firstName = profileData.name.split(" ")[0];
            nameNode.textContent = profileData.name;
            avatarNode.textContent = profileData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        } else if (user.email) {
            firstName = user.email.split("@")[0];
            nameNode.textContent = user.email;
            avatarNode.textContent = user.email.slice(0, 2).toUpperCase();
        }
        
        if (activeLang === "mr") {
            greetingNode.textContent = `${firstName}, ${welcomeText}`;
        } else {
            greetingNode.textContent = `${welcomeText}, ${firstName}`;
        }
    }
    greetUser();

    // Load Clinical Care Notes from Doctor if available
    const notesCard = document.getElementById("clinicalNotesCard");
    const notesText = document.getElementById("clinicalNotesText");
    const notesDate = document.getElementById("clinicalNotesDate");
    
    if (profileData.doctorNote) {
        notesCard.style.display = "block";
        notesText.textContent = profileData.doctorNote;
        if (profileData.doctorNoteDate) {
            const nd = new Date(profileData.doctorNoteDate);
            notesDate.textContent = `Posted on ${nd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        } else {
            notesDate.textContent = "Clinical Specialist";
        }
    } else {
        notesCard.style.display = "none";
    }

    const subtitleNode = document.getElementById("lastAssessmentSubtitle");
    const tableBody = document.getElementById("predictionsHistoryTable");
    const recsList = document.getElementById("dashboardRecommendationsList");
    const advisoryIntro = document.getElementById("advisoryIntro");

    // Appointment inputs
    const doctorSelect = document.getElementById("doctorSelect");
    const appointmentForm = document.getElementById("bookAppointmentForm");
    const appointmentHistoryTable = document.getElementById("patientAppointmentsHistoryTable");
    const bookBtn = document.getElementById("btnBookAppointment");

    // Dynamic UI rendering engine for localization support
    function renderDashboardState(latest, predictions) {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        
        // Update Subtitle Date
        const lastDate = new Date(latest.date);
        const formattedDate = lastDate.toLocaleDateString(activeLang === "hi" ? "hi-IN" : activeLang === "mr" ? "mr-IN" : "en-US", { 
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" 
        });
        const labelText = window.i18n ? window.i18n.translateText("last_assessment_run_on", activeLang) : "Last assessment run on";
        // If translation key doesn't exist, we fall back gracefully
        const fallbackLabel = labelText === "last_assessment_run_on" ? "Last assessment run on" : labelText;
        subtitleNode.textContent = `${fallbackLabel} ${formattedDate}`;

        // Animate SVG Health Score Progress Ring
        const score = latest.healthScore;
        const scoreDisplay = document.getElementById("healthScoreDisplay");
        const scoreCircle = document.getElementById("healthCircleProgress");
        const statusBadge = document.getElementById("dashboardHealthStatus");
        
        scoreDisplay.textContent = score;
        
        // Calculate offset (r=60, perimeter = 2 * PI * r = 377)
        const circumference = 377;
        const offset = circumference * (1 - score / 100);
        
        setTimeout(() => {
            if (scoreCircle) scoreCircle.style.strokeDashoffset = offset;
        }, 100);

        if (score >= 80) {
            if (scoreCircle) scoreCircle.style.stroke = "var(--color-success)";
            statusBadge.className = "badge-risk low";
            statusBadge.textContent = window.i18n ? window.i18n.translateText("low_risk", activeLang) : "Low Risk";
        } else if (score >= 50) {
            if (scoreCircle) scoreCircle.style.stroke = "var(--color-warning)";
            statusBadge.className = "badge-risk medium";
            statusBadge.textContent = window.i18n ? window.i18n.translateText("medium_risk", activeLang) : "Medium Risk";
        } else {
            if (scoreCircle) scoreCircle.style.stroke = "var(--color-danger)";
            statusBadge.className = "badge-risk high";
            statusBadge.textContent = window.i18n ? window.i18n.translateText("high_risk", activeLang) : "High Risk";
        }
        statusBadge.style.display = "inline-block";

        // Update Primary Clinical Concern Panel
        const concernLabel = document.getElementById("dashboardConcernLabel");
        const insightsText = document.getElementById("dashboardInsightsText");
        const riskFooterText = document.getElementById("riskFooterText");

        // Try mapping disease name, if it matches one of standard keys
        let translatedDisease = latest.predictedDisease;
        if (latest.predictedDisease) {
            const diseaseKey = "disease_" + latest.predictedDisease.toLowerCase().replace(/\s+/g, "_");
            const lookup = window.i18n ? window.i18n.translateText(diseaseKey, activeLang) : latest.predictedDisease;
            if (lookup !== diseaseKey) {
                translatedDisease = lookup;
            }
        }
        concernLabel.textContent = translatedDisease;
        insightsText.textContent = latest.insights; // Insights are generated per patient scan in DB
        
        let indicatorColor = "var(--color-success)";
        if (latest.riskLevel === "High") indicatorColor = "var(--color-danger)";
        else if (latest.riskLevel === "Medium") indicatorColor = "var(--color-warning)";

        const severityText = window.i18n ? window.i18n.translateText(latest.riskLevel.toLowerCase() + "_risk", activeLang) : `${latest.riskLevel} Risk`;
        riskFooterText.innerHTML = `
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${indicatorColor}; box-shadow: 0 0 10px ${indicatorColor}; margin-right: 6px;"></span>
            Confidence Level: ${latest.confidence}% | Severity: ${severityText}
        `;

        // Update Vitals Detail Cards
        // BMI Card
        const bmiDisplay = document.getElementById("dashboardBmiDisplay");
        const bmiBadge = document.getElementById("dashboardBmiBadge");
        
        bmiDisplay.textContent = latest.bmi;
        const bmiCategoryKey = latest.bmiCategory ? latest.bmiCategory.toLowerCase() : "normal";
        bmiBadge.textContent = window.i18n ? window.i18n.translateText(bmiCategoryKey, activeLang) : latest.bmiCategory;
        if (latest.bmiCategory === "Normal") bmiBadge.className = "metric-badge success";
        else if (latest.bmiCategory === "Underweight" || latest.bmiCategory === "Overweight") bmiBadge.className = "metric-badge warning";
        else bmiBadge.className = "metric-badge danger";
        bmiBadge.style.display = "inline-block";

        // Blood Pressure Card
        const bpDisplay = document.getElementById("dashboardBpDisplay");
        const bpBadge = document.getElementById("dashboardBpBadge");
        
        bpDisplay.textContent = `${latest.systolic}/${latest.diastolic}`;
        
        let bpStatus = "normal";
        let bpBadgeClass = "success";
        if (latest.systolic >= 140 || latest.diastolic >= 90) {
            bpStatus = "bp_stage2";
            bpBadgeClass = "danger";
        } else if (latest.systolic >= 130 || latest.diastolic >= 80) {
            bpStatus = "bp_stage1";
            bpBadgeClass = "warning";
        } else if (latest.systolic >= 120 && latest.diastolic < 80) {
            bpStatus = "bp_elevated";
            bpBadgeClass = "warning";
        }
        
        bpBadge.textContent = window.i18n ? window.i18n.translateText(bpStatus, activeLang) : bpStatus;
        bpBadge.className = `metric-badge ${bpBadgeClass}`;
        bpBadge.style.display = "inline-block";

        // Fasting Glucose Card
        const glucoseDisplay = document.getElementById("dashboardGlucoseDisplay");
        const glucoseBadge = document.getElementById("dashboardGlucoseBadge");
        
        glucoseDisplay.textContent = `${latest.glucose} mg/dL`;
        
        let glucStatus = "normal";
        let glucBadgeClass = "success";
        if (latest.glucose >= 126) {
            glucStatus = "glucose_diabetic";
            glucBadgeClass = "danger";
        } else if (latest.glucose >= 100) {
            glucStatus = "glucose_pre_diabetic";
            glucBadgeClass = "warning";
        }
        
        glucoseBadge.textContent = window.i18n ? window.i18n.translateText(glucStatus, activeLang) : glucStatus;
        glucoseBadge.className = `metric-badge ${glucBadgeClass}`;
        glucoseBadge.style.display = "inline-block";

        // Compile AI Health Recommendations Checklist
        advisoryIntro.textContent = window.i18n ? window.i18n.translateText("actions_calculated_indicators", activeLang) : "Actions calculated based on your biometric profile indicators:";
        
        const recommendations = [];
        if (latest.glucose >= 100) {
            recommendations.push({
                icon: "fa-solid fa-candy-cane",
                color: "var(--color-danger)",
                text: window.i18n ? window.i18n.translateText("rec_sugar", activeLang) : "Sugar Restricting: Minimize refined sucrose, beverages, and simple starches to control glycemic indexes."
            });
        }
        if (latest.systolic >= 120 || latest.diastolic >= 80) {
            recommendations.push({
                icon: "fa-solid fa-salt-shaker",
                color: "var(--color-warning)",
                text: window.i18n ? window.i18n.translateText("rec_sodium", activeLang) : "Sodium Restricting: Curb daily sodium to less than 2,000mg and substitute salt for herbal spices."
            });
        }
        if (latest.bmi >= 25) {
            recommendations.push({
                icon: "fa-solid fa-plate-wheat",
                color: "var(--color-accent)",
                text: window.i18n ? window.i18n.translateText("rec_weight", activeLang) : "Weight Management: Shift food layouts to higher protein/fiber ratios and track calorie intakes."
            });
        }
        if (latest.smoking === "active" || latest.smoking === "occasional") {
            recommendations.push({
                icon: "fa-solid fa-ban-smoking",
                color: "var(--color-danger)",
                text: window.i18n ? window.i18n.translateText("rec_nicotine", activeLang) : "Nicotine Stopping: Contact clinical cessation specialists. Quitting immediately drops coronary risks by 50%."
            });
        }
        if (latest.activity === "sedentary") {
            recommendations.push({
                icon: "fa-solid fa-person-running",
                color: "var(--color-primary)",
                text: window.i18n ? window.i18n.translateText("rec_cardio", activeLang) : "Physical Vitals: Accumulate at least 150 minutes of moderate aerobic exercises weekly."
            });
        }
        recommendations.push({
            icon: "fa-solid fa-calendar-check",
            color: "var(--color-success)",
            text: window.i18n ? window.i18n.translateText("rec_standard", activeLang) : "Standard Diagnostics: Schedule a comprehensive clinical annual blood lipid and metabolic panel."
        });

        recsList.innerHTML = recommendations.map(rec => `
            <div style="display: flex; align-items: flex-start; gap: 14px; font-size: 0.85rem; color: var(--text-secondary);">
                <div style="min-width: 26px; height: 26px; border-radius: 6px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: ${rec.color};">
                    <i class="${rec.icon}"></i>
                </div>
                <span>${rec.text}</span>
            </div>
        `).join("");

        // Populate Recent Predictions Table Rows
        tableBody.innerHTML = predictions.map(pred => {
            const predDate = new Date(pred.date);
            const shortDate = predDate.toLocaleDateString(activeLang === "hi" ? "hi-IN" : activeLang === "mr" ? "mr-IN" : "en-US", { month: "short", day: "numeric", year: "numeric" });
            
            let riskClass = "low";
            if (pred.riskLevel === "High") riskClass = "high";
            else if (pred.riskLevel === "Medium") riskClass = "medium";

            const rowSeverityText = window.i18n ? window.i18n.translateText(pred.riskLevel.toLowerCase() + "_risk", activeLang) : `${pred.riskLevel} Risk`;
            const viewBtnLabel = window.i18n ? window.i18n.translateText("View", activeLang) : "View";
            
            let rowDisease = pred.predictedDisease;
            if (pred.predictedDisease) {
                const diseaseKey = "disease_" + pred.predictedDisease.toLowerCase().replace(/\s+/g, "_");
                const rowLookup = window.i18n ? window.i18n.translateText(diseaseKey, activeLang) : pred.predictedDisease;
                if (rowLookup !== diseaseKey) {
                    rowDisease = rowLookup;
                }
            }

            return `
                <tr>
                    <td style="font-weight: 500;">${shortDate}</td>
                    <td>
                        <span style="font-weight: 600; color: ${pred.healthScore >= 80 ? 'var(--color-success)' : pred.healthScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'};">
                            ${pred.healthScore} / 100
                        </span>
                    </td>
                    <td style="color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rowDisease}</td>
                    <td><span class="badge-risk ${riskClass}">${rowSeverityText}</span></td>
                    <td>
                        <button class="btn-outline view-report-btn" data-id="${pred.id}" style="padding: 6px 12px; font-size: 0.775rem; border-radius: 6px;">
                            <i class="fa-solid fa-file-invoice"></i> ${viewBtnLabel}
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Rebind report details
        document.querySelectorAll(".view-report-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const reportId = btn.getAttribute("data-id");
                localStorage.setItem("lastPredictionId", reportId);
                window.location = "results.html";
            });
        });
    }

    // Load Vitals Dashboard & Historical Records
    async function loadDashboardData() {
        try {
            // 2. Fetch User Prediction History from root healthRecords collection
            const predictionsColRef = collection(db, "healthRecords");
            const predictionsQuery = query(predictionsColRef, where("patientId", "==", user.uid));
            const snapshot = await getDocs(predictionsQuery);

            if (snapshot.empty) {
                const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
                subtitleNode.textContent = window.i18n ? window.i18n.translateText("no_scan_run", activeLang) : "You haven't run any health assessment scans yet.";
                const noScansLabel = window.i18n ? window.i18n.translateText("no_reports_catalog", activeLang) : "No previous health scans found.";
                const startScanLabel = window.i18n ? window.i18n.translateText("start_free_scan", activeLang) : "Start Your First Assessment";
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 50px 0;">
                            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 12px; display: block; color: var(--text-muted);"></i>
                            ${noScansLabel} 
                            <a href="assessment.html" style="color: var(--color-primary); text-decoration: none; font-weight: 600; margin-left: 5px;">${startScanLabel}</a>
                        </td>
                    </tr>
                `;
                return;
            }

            // Extract & Sort records client side
            const predictions = [];
            snapshot.forEach((docSnap) => {
                predictions.push({ id: docSnap.id, ...docSnap.data() });
            });
            predictions.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Set state variables for real-time translation toggles
            localPredictions = predictions;
            localLatest = predictions[0];

            // Render dashboard contents in selected language
            renderDashboardState(localLatest, localPredictions);

            // Fetch and render clinical doctor reports and health timeline
            await loadReportsAndTimeline(predictions);

        } catch (err) {
            console.error("Dashboard Sync Error: ", err);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--color-danger); padding: 30px 0;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
                        Failed to synchronise clinical record: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // Connect language changed event handler to refresh dynamic state
    window.addEventListener("languagechanged", () => {
        greetUser();
        if (localLatest && localPredictions) {
            renderDashboardState(localLatest, localPredictions);
        }
    });

    // 3. Load Doctors List in Dropdown
    async function loadDoctorsDropdown() {
        try {
            doctorSelect.innerHTML = `<option value="" disabled selected>Loading registered doctors...</option>`;
            
            const doctorsSnap = await getDocs(collection(db, "doctors"));
            const doctors = [];
            
            doctorsSnap.forEach((docSnap) => {
                const dData = docSnap.data();
                doctors.push({ id: docSnap.id, ...dData });
            });

            if (doctors.length === 0) {
                doctorSelect.innerHTML = `<option value="" disabled selected>No clinical doctors available</option>`;
                return;
            }

            doctorSelect.innerHTML = `<option value="" disabled selected>Select Clinic Specialist</option>` + 
                doctors.map(d => `<option value="${d.id}" data-name="${d.name}">Dr. ${d.name} (${d.specialization || 'Clinical Generalist'})</option>`).join("");

        } catch (err) {
            console.error("Failed to load doctor lists: ", err);
            doctorSelect.innerHTML = `<option value="" disabled selected>Failed to load doctors dropdown</option>`;
        }
    }

    // 4. Load Patient Requested Appointments list
    async function loadAppointmentsList() {
        try {
            appointmentHistoryTable.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Synchronising appointments...
                    </td>
                </tr>
            `;

            // Query appointments matching patientId
            const q = query(collection(db, "appointments"), where("patientId", "==", user.uid));
            const snap = await getDocs(q);

            if (snap.empty) {
                appointmentHistoryTable.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                            No requested visits on catalog.
                        </td>
                    </tr>
                `;
                return;
            }

            const apps = [];
            snap.forEach((docSnap) => {
                apps.push(docSnap.data());
            });
            // Sort chronologically by appointment date
            apps.sort((a, b) => new Date(a.date) - new Date(b.date));

            appointmentHistoryTable.innerHTML = apps.map(app => {
                const ad = new Date(app.date);
                const fd = ad.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
                
                let badgeClass = "pending";
                if (app.status === "approved") badgeClass = "approved";
                else if (app.status === "cancelled") badgeClass = "cancelled";
                else if (app.status === "rescheduled") badgeClass = "approved";

                let notesHtml = app.doctorNotes ? `<div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">Note: ${app.doctorNotes}</div>` : "";
                let videoHtml = (app.status === "approved" || app.status === "rescheduled") && app.videoLink
                    ? `<div style="margin-top: 6px;"><a href="${app.videoLink}" target="_blank" class="btn-primary" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 4px;"><i class="fa-solid fa-video"></i> Join Consultation</a></div>`
                    : "";

                return `
                    <tr>
                        <td style="font-weight: 500;">
                            <i class="fa-regular fa-user-doctor" style="color:var(--color-primary); margin-right:6px;"></i> Dr. ${app.doctorName}
                            ${notesHtml}
                            ${videoHtml}
                        </td>
                        <td style="color: var(--text-secondary); font-size:0.8rem;">${fd}</td>
                        <td><span class="badge-status ${badgeClass}">${app.status.toUpperCase()}</span></td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Failed to load appointments: ", err);
            appointmentHistoryTable.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: var(--color-danger); padding: 20px 0;">
                        Failed to sync appointments: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // 5. Submit Consultation Booking form
    if (appointmentForm) {
        appointmentForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const doctorId = doctorSelect.value;
            const selectedOpt = doctorSelect.options[doctorSelect.selectedIndex];
            const doctorName = selectedOpt.getAttribute("data-name");
            const appointmentDateVal = document.getElementById("appointmentDate").value;

            try {
                bookBtn.disabled = true;
                bookBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Scheduling...';

                // Save appointment to root appointments collection
                await addDoc(collection(db, "appointments"), {
                    patientId: user.uid,
                    patientName: profileData.name || user.email.split("@")[0],
                    doctorId,
                    doctorName,
                    date: appointmentDateVal,
                    status: "pending",
                    createdAt: new Date().toISOString()
                });

                alert("Biometric consultation scheduled successfully. Please wait for practitioner approval.");
                appointmentForm.reset();
                
                // Refresh list
                loadAppointmentsList();

            } catch (err) {
                console.error("Failed to schedule appointment: ", err);
                alert("Consultation request failed: " + err.message);
            } finally {
                bookBtn.disabled = false;
                bookBtn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Request Appointment';
            }
        });
    }

    // ==========================================
    // Real-Time Notifications Hub
    // ==========================================
    const bellBtn = document.getElementById("notificationBellBtn");
    const bellBadge = document.getElementById("notificationBadge");
    const dropdown = document.getElementById("notificationDropdown");
    const notifsList = document.getElementById("notificationsList");
    const clearNotifsBtn = document.getElementById("btnMarkNotificationsRead");

    if (bellBtn) {
        bellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        });
        
        document.addEventListener("click", () => {
            dropdown.style.display = "none";
        });
        
        dropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    const notifQuery = query(collection(db, "notifications"), where("userId", "==", user.uid));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
        const notifs = [];
        snapshot.forEach(docSnap => notifs.push({ id: docSnap.id, ...docSnap.data() }));
        notifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const unreadCount = notifs.filter(n => !n.read).length;
        if (unreadCount > 0) {
            bellBadge.textContent = unreadCount;
            bellBadge.style.display = "flex";
        } else {
            bellBadge.style.display = "none";
        }
        
        if (notifs.length === 0) {
            notifsList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px 0;">No new alerts</div>`;
        } else {
            notifsList.innerHTML = notifs.map(n => `
                <div style="background: ${n.read ? 'rgba(255,255,255,0.01)' : 'rgba(59,130,246,0.04)'}; border-left: 3px solid ${n.read ? 'transparent' : 'var(--color-primary)'}; padding: 10px; border-radius: var(--radius-sm); font-size: 0.775rem;">
                    <div style="font-weight: 600; display: flex; justify-content: space-between;">
                        <span>${n.title}</span>
                        <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal;">${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div style="color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">${n.message}</div>
                </div>
            `).join("");
        }
    });

    if (clearNotifsBtn) {
        clearNotifsBtn.addEventListener("click", async () => {
            try {
                const notifSnap = await getDocs(notifQuery);
                const deletePromises = [];
                notifSnap.forEach((docSnap) => {
                    deletePromises.push(deleteDoc(doc(db, "notifications", docSnap.id)));
                });
                await Promise.all(deletePromises);
            } catch (err) {
                console.error("Clear notifications failed: ", err);
            }
        });
    }

    // ==========================================
    // Emergency SOS Panel Operations
    // ==========================================
    const triggerSOS = document.getElementById("btnTriggerSOS");
    const exitSos = document.getElementById("btnExitSosModal");
    const sosModal = document.getElementById("sosModal");
    const broadcastSOS = document.getElementById("btnBroadcastSOS");

    if (triggerSOS && sosModal) {
        triggerSOS.addEventListener("click", () => {
            document.getElementById("sosBloodGroup").textContent = profileData.bloodGroup || "Not Provided";
            document.getElementById("sosAge").textContent = profileData.age ? `${profileData.age} Yrs` : "Not Provided";
            document.getElementById("sosMedicalHistory").textContent = profileData.medicalHistory || "No pre-existing clinical history specified.";
            document.getElementById("sosContactName").textContent = profileData.emergencyContactName || "--";
            document.getElementById("sosContactRelation").textContent = profileData.emergencyContactRelation || "--";
            const phone = profileData.emergencyContactPhone || "";
            document.getElementById("sosContactPhoneBtn").href = phone ? "tel:" + phone : "#";
            if (!phone) {
                document.getElementById("sosContactPhoneBtn").style.opacity = 0.5;
                document.getElementById("sosContactPhoneBtn").style.pointerEvents = "none";
            } else {
                document.getElementById("sosContactPhoneBtn").style.opacity = 1;
                document.getElementById("sosContactPhoneBtn").style.pointerEvents = "auto";
            }
            sosModal.style.display = "flex";
        });
        
        exitSos.addEventListener("click", () => {
            sosModal.style.display = "none";
        });
    }

    if (broadcastSOS) {
        broadcastSOS.addEventListener("click", async () => {
            try {
                broadcastSOS.disabled = true;
                broadcastSOS.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatched...';

                // Find Doctor patient has scheduled booking with
                const appQuery = query(collection(db, "appointments"), where("patientId", "==", user.uid));
                const appSnap = await getDocs(appQuery);
                
                let targetDoctorId = "all_specialists";
                if (!appSnap.empty) {
                    targetDoctorId = appSnap.docs[0].data().doctorId;
                }
                
                await addDoc(collection(db, "notifications"), {
                    userId: targetDoctorId,
                    title: "🚨 CRITICAL: Patient SOS Emergency!",
                    message: `${profileData.name || "Patient Member"} has triggered a critical medical SOS! Contact Name: ${profileData.emergencyContactName || "--"} (${profileData.emergencyContactPhone || "--"}).`,
                    timestamp: new Date().toISOString(),
                    read: false
                });

                alert("SOS Emergency vital broadcast successfully dispatched to specialist practitioners.");
                sosModal.style.display = "none";
            } catch (err) {
                console.error("SOS Broadcast error: ", err);
                alert("SOS Broadcast failed: " + err.message);
            } finally {
                broadcastSOS.disabled = false;
                broadcastSOS.innerHTML = '<i class="fa-solid fa-satellite-dish fa-pulse"></i> Broadcast SOS to Booking Specialist';
            }
        });
    }

    // ==========================================
    // Interactive Reminders & Habits Tracker
    // ==========================================
    const chkMeds = document.getElementById("chkMedsReminder");
    const chkExercise = document.getElementById("chkExerciseReminder");
    const chkCheckup = document.getElementById("chkCheckupReminder");
    const waterCountDisplay = document.getElementById("waterGlassesCount");
    const btnIncWater = document.getElementById("btnIncWater");
    const btnDecWater = document.getElementById("btnDecWater");

    const todayStr = new Date().toDateString();

    if (chkMeds) {
        chkMeds.checked = localStorage.getItem(user.uid + "_meds_" + todayStr) === "true";
        chkMeds.addEventListener("change", () => {
            localStorage.setItem(user.uid + "_meds_" + todayStr, chkMeds.checked);
        });
    }

    if (chkExercise) {
        chkExercise.checked = localStorage.getItem(user.uid + "_exercise_" + todayStr) === "true";
        chkExercise.addEventListener("change", () => {
            localStorage.setItem(user.uid + "_exercise_" + todayStr, chkExercise.checked);
        });
    }

    if (chkCheckup) {
        chkCheckup.checked = localStorage.getItem(user.uid + "_checkup_" + todayStr) === "true";
        chkCheckup.addEventListener("change", () => {
            localStorage.setItem(user.uid + "_checkup_" + todayStr, chkCheckup.checked);
        });
    }

    let waterCount = parseInt(localStorage.getItem(user.uid + "_water_" + todayStr)) || 0;
    if (waterCountDisplay) waterCountDisplay.textContent = waterCount;

    if (btnIncWater) {
        btnIncWater.addEventListener("click", () => {
            waterCount = Math.min(waterCount + 1, 20);
            waterCountDisplay.textContent = waterCount;
            localStorage.setItem(user.uid + "_water_" + todayStr, waterCount);
        });
    }

    if (btnDecWater) {
        btnDecWater.addEventListener("click", () => {
            waterCount = Math.max(waterCount - 1, 0);
            waterCountDisplay.textContent = waterCount;
            localStorage.setItem(user.uid + "_water_" + todayStr, waterCount);
        });
    }

    // ==========================================
    // Tab Toggling Panel Views
    // ==========================================
    const tabScans = document.getElementById("tabScans");
    const tabReports = document.getElementById("tabReports");
    const tabTimeline = document.getElementById("tabTimeline");

    const panelScans = document.getElementById("panelScans");
    const panelReports = document.getElementById("panelReports");
    const panelTimeline = document.getElementById("panelTimeline");

    function setActiveTab(activeTab, activePanel) {
        [tabScans, tabReports, tabTimeline].forEach(t => t.classList.remove("active"));
        [panelScans, panelReports, panelTimeline].forEach(p => p.classList.remove("active"));
        activeTab.classList.add("active");
        activePanel.classList.add("active");
    }

    if (tabScans && panelScans) {
        tabScans.addEventListener("click", () => setActiveTab(tabScans, panelScans));
        tabReports.addEventListener("click", () => setActiveTab(tabReports, panelReports));
        tabTimeline.addEventListener("click", () => setActiveTab(tabTimeline, panelTimeline));
    }

    // ==========================================
    // Load Clinical Specialist Reports & Timeline
    // ==========================================
    async function loadReportsAndTimeline(predictions) {
        try {
            const reportsColRef = collection(db, "doctorReports");
            const reportsQuery = query(reportsColRef, where("patientId", "==", user.uid));
            const reportsSnap = await getDocs(reportsQuery);
            
            const reports = [];
            reportsSnap.forEach((docSnap) => {
                reports.push({ id: docSnap.id, ...docSnap.data() });
            });
            reports.sort((a, b) => new Date(b.date) - new Date(a.date));

            const reportsCountNode = document.getElementById("reportsCount");
            if (reportsCountNode) reportsCountNode.textContent = reports.length;

            const reportsList = document.getElementById("patientReportsList");
            if (reportsList) {
                if (reports.length === 0) {
                    reportsList.innerHTML = `
                        <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 40px 0;">
                            <i class="fa-solid fa-prescription" style="font-size: 2rem; margin-bottom: 10px; display: block; color: var(--text-muted);"></i>
                            No published specialist reports on catalog.
                        </div>
                    `;
                } else {
                    reportsList.innerHTML = reports.map(r => {
                        const rd = new Date(r.date);
                        const formattedDate = rd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
                        
                        return `
                            <div class="glass-card" style="padding: 20px; background: rgba(255,255,255,0.01); border-color: rgba(139, 92, 246, 0.25); margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; border-bottom: 1px dashed var(--border-card); padding-bottom: 10px;">
                                    <div>
                                        <h4 style="font-size: 1rem; color: var(--color-accent); margin-bottom:0;"><i class="fa-solid fa-user-doctor"></i> Dr. ${r.doctorName}</h4>
                                        <span style="font-size: 0.725rem; color: var(--text-muted);">${formattedDate} | ${r.clinicName || 'Specialist Hospital'}</span>
                                    </div>
                                    <button class="btn-outline print-report-btn" data-id="${r.id}" style="padding: 6px 12px; font-size: 0.75rem; border-radius: 6px; gap: 6px; border-color: var(--color-accent); color: var(--color-accent);">
                                        <i class="fa-solid fa-download"></i> Download / Print Rx
                                    </button>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;">
                                    <div><strong style="color: var(--text-secondary); display: block; margin-bottom: 2px;">Diagnosis:</strong> <span style="font-weight: 600;">${r.diagnosis}</span></div>
                                    
                                    <div style="background: rgba(139, 92, 246, 0.03); border: 1px solid rgba(139, 92, 246, 0.15); padding: 12px; border-radius: var(--radius-sm);">
                                        <strong style="color: var(--color-accent); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;"><i class="fa-solid fa-prescription"></i> Rx Prescription</strong>
                                        <div style="color: var(--text-primary); line-height: 1.4; white-space: pre-line;">${r.prescription}</div>
                                    </div>
                                    
                                    <div><strong style="color: var(--text-secondary); display: block; margin-bottom: 2px;">Recommendations & Advices:</strong> <p style="color: var(--text-secondary); margin-bottom: 0;">${r.recommendations}</p></div>
                                </div>
                            </div>
                        `;
                    }).join("");

                    document.querySelectorAll(".print-report-btn").forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const repId = btn.getAttribute("data-id");
                            const rep = reports.find(r => r.id === repId);
                            if (rep) {
                                printMedicalReport(rep);
                            }
                        });
                    });
                }
            }

            const appsSnap = await getDocs(query(collection(db, "appointments"), where("patientId", "==", user.uid)));
            const appointments = [];
            appsSnap.forEach(d => appointments.push(d.data()));

            const timelineEvents = [];
            
            predictions.forEach(p => {
                timelineEvents.push({
                    date: new Date(p.date),
                    title: "AI Health Assessment Scan",
                    desc: `Health Score: ${p.healthScore}/100 | Vitals analyzed: BP: ${p.systolic}/${p.diastolic}, Glucose: ${p.glucose} mg/dL. Diagnosis index: ${p.predictedDisease}.`,
                    icon: "fa-solid fa-stethoscope",
                    color: p.healthScore >= 80 ? "var(--color-success)" : p.healthScore >= 50 ? "var(--color-warning)" : "var(--color-danger)"
                });
            });

            reports.forEach(r => {
                timelineEvents.push({
                    date: new Date(r.date),
                    title: `Medical Report Published`,
                    desc: `Dr. ${r.doctorName} published clinical diagnosis: "${r.diagnosis}". Prescription issued.`,
                    icon: "fa-solid fa-file-prescription",
                    color: "var(--color-accent)"
                });
            });

            appointments.forEach(a => {
                timelineEvents.push({
                    date: new Date(a.date),
                    title: `Consultation with Dr. ${a.doctorName}`,
                    desc: `Visit requested for date ${new Date(a.date).toLocaleDateString()}. Status: ${a.status.toUpperCase()}.${a.doctorNotes ? ' Notes appended.' : ''}`,
                    icon: "fa-regular fa-calendar-check",
                    color: "var(--color-primary)"
                });
            });

            timelineEvents.sort((a, b) => b.date - a.date);

            const timelineContainer = document.getElementById("patientTimelineContainer");
            if (timelineContainer) {
                if (timelineEvents.length === 0) {
                    timelineContainer.innerHTML = `
                        <div style="position: absolute; top: 0; bottom: 0; left: 7px; width: 2px; background: var(--border-card);"></div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 40px 0;">
                            No clinical events logged yet.
                        </div>
                    `;
                } else {
                    timelineContainer.innerHTML = `
                        <div style="position: absolute; top: 0; bottom: 0; left: 7px; width: 2px; background: var(--border-card);"></div>
                        ` + timelineEvents.map(e => `
                        <div style="position: relative; padding-left: 10px; margin-bottom: 5px;">
                            <div style="position: absolute; left: -22px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${e.color}; box-shadow: 0 0 8px ${e.color};"></div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">${e.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                            <h5 style="font-size: 0.85rem; font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 6px; margin-bottom: 0;"><i class="${e.icon}" style="color: ${e.color}; font-size: 0.8rem;"></i> ${e.title}</h5>
                            <p style="font-size: 0.775rem; color: var(--text-secondary); line-height: 1.4; margin-top: 3px; margin-bottom: 0;">${e.desc}</p>
                        </div>
                    `).join("");
                }
            }

        } catch (err) {
            console.error("Timeline/Reports loading failed: ", err);
        }
    }

    function printMedicalReport(r) {
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
            <head>
                <title>Medical Report | WellnessInsight</title>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { font-size: 1.5rem; font-weight: 700; color: #3b82f6; }
                    .report-title { text-align: center; font-size: 1.8rem; font-weight: 700; margin-bottom: 35px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
                    .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 35px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; }
                    .details-group { font-size: 0.9rem; }
                    .details-group strong { color: #475569; }
                    .section { margin-bottom: 30px; }
                    .section-title { font-size: 1.1rem; font-weight: 700; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .prescription-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 20px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; white-space: pre-wrap; color: #0f172a; }
                    .footer { margin-top: 80px; text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                    .signature-box { display: flex; justify-content: flex-end; margin-top: 60px; }
                    .signature-line { width: 220px; border-top: 1px solid #94a3b8; text-align: center; font-size: 0.85rem; color: #475569; padding-top: 8px; }
                    @media print {
                        body { padding: 20px; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">WellnessInsight Health Systems</div>
                    <div style="text-align: right; font-size: 0.85rem; color: #64748b;">HIPAA Secure Record</div>
                </div>
                
                <div class="report-title">Outpatient Medical Report</div>
                
                <div class="details-grid">
                    <div class="details-group"><strong>Patient Name:</strong> ${profileData.name || 'Patient Member'}</div>
                    <div class="details-group"><strong>Blood Group:</strong> ${profileData.bloodGroup || '--'}</div>
                    <div class="details-group"><strong>Patient Age:</strong> ${profileData.age ? profileData.age + ' Years' : '--'}</div>
                    <div class="details-group"><strong>Date of Assessment:</strong> ${new Date(r.date).toLocaleString()}</div>
                    <div class="details-group"><strong>Consultant Practitioner:</strong> Dr. ${r.doctorName}</div>
                    <div class="details-group"><strong>Clinic Facility:</strong> ${r.clinicName || 'Medical Specialty Hospital'}</div>
                </div>
                
                <div class="section">
                    <div class="section-title">Clinical Diagnosis</div>
                    <p style="font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0;">${r.diagnosis}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Rx Treatment & Prescription</div>
                    <div class="prescription-box">${r.prescription}</div>
                </div>
                
                <div class="section">
                    <div class="section-title">Practitioner Recommendations</div>
                    <p style="font-size: 0.95rem; margin: 0; color: #334155;">${r.recommendations}</p>
                </div>
                
                <div class="signature-box">
                    <div class="signature-line">
                        <strong>Dr. ${r.doctorName}</strong><br>
                        Authorized Clinician Signature
                    </div>
                </div>
                
                <div class="footer">
                    This document is a certified outpatient report generated by the WellnessInsight Diagnostic SaaS Platform.<br>
                    &copy; 2026 WellnessInsight Health Predictors. All Rights Reserved.
                </div>
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // Initialize all loaders
    loadDashboardData();
    loadDoctorsDropdown();
    loadAppointmentsList();
});
