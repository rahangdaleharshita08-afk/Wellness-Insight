import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot,
    deleteDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

checkAuth(async (user, profileData) => {
    // 1. Greet Doctor in Sidebar & Header
    const nameNode = document.getElementById("sidebarName");
    const avatarNode = document.getElementById("sidebarAvatar");
    const greetingNode = document.getElementById("welcomeDoctorGreeting");
    
    let doctorName = "Specialist";
    if (profileData.name) {
        doctorName = profileData.name;
    } else if (user.email) {
        doctorName = user.email.split("@")[0];
    }

    function getStatusLabel(status, lang) {
        if (lang === "hi") {
            switch(status) {
                case "pending": return "लंबित";
                case "approved": return "स्वीकृत";
                case "cancelled": return "रद्द";
                case "rescheduled": return "पुनर्निर्धारित";
                default: return status.toUpperCase();
            }
        } else if (lang === "mr") {
            switch(status) {
                case "pending": return "लंबित";
                case "approved": return "मंजूर";
                case "cancelled": return "रद्द";
                case "rescheduled": return "पुनर्निर्धारित";
                default: return status.toUpperCase();
            }
        }
        return status.toUpperCase();
    }

    function greetDoctor() {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        const welcomeText = window.i18n ? window.i18n.translateText("welcome_specialist_greeting", activeLang) : "Welcome, Specialist";
        
        let lastName = "Specialist";
        let fullName = "Specialist";
        if (profileData.name) {
            lastName = profileData.name.split(" ").pop();
            fullName = profileData.name;
        } else if (user.email) {
            lastName = user.email.split("@")[0];
            fullName = lastName;
        }

        const drLabel = (activeLang === "en") ? "Dr." : "डॉ.";
        nameNode.textContent = `${drLabel} ${fullName}`;
        
        if (profileData.name) {
            avatarNode.textContent = profileData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        } else {
            avatarNode.textContent = lastName.slice(0, 2).toUpperCase();
        }

        if (activeLang === "mr") {
            greetingNode.textContent = `${drLabel} ${lastName}, ${welcomeText}`;
        } else if (activeLang === "hi") {
            greetingNode.textContent = `${drLabel} ${lastName}, ${welcomeText}`;
        } else {
            greetingNode.textContent = `Welcome, Dr. ${lastName}`;
        }
    }

    function updateSpecialistProfileCard() {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        const specLabel = window.i18n ? window.i18n.translateText("sidebar_role_doctor", activeLang) : "Clinical Specialist";
        
        document.getElementById("docProfileSpecialization").textContent = profileData.specialization || specLabel;
        
        let expText = specLabel;
        if (profileData.experience) {
            const yearsLabel = activeLang === "mr" ? "वर्षे" : activeLang === "hi" ? "वर्ष" : "Years";
            expText = `${profileData.experience} ${yearsLabel}`;
        }
        document.getElementById("docProfileExperience").textContent = expText;
        document.getElementById("docProfileClinicName").textContent = profileData.clinicName || "Medical General Hospital";
        document.getElementById("docProfileLicenseNumber").textContent = profileData.licenseNumber || "LIC-PENDING-USA";
        document.getElementById("docProfilePhone").textContent = profileData.phone || "--";
    }

    greetDoctor();
    updateSpecialistProfileCard();

    // DOM Elements
    const directoryBody = document.getElementById("doctorPatientsDirectoryTable");
    const appointmentsBody = document.getElementById("doctorAppointmentsHistoryTable");
    const searchInput = document.getElementById("searchPatients");
    
    // Auditing Modal & Elements
    const auditModal = document.getElementById("auditModal");
    const btnExitModal = document.getElementById("btnExitModal");
    const btnCancelModal = document.getElementById("btnCancelModal");
    const feedbackText = document.getElementById("clinicalFeedbackText");
    const saveAdviceBtn = document.getElementById("btnSaveAuditNotes");

    // Modal tabs & panels
    const modalTabVitals = document.getElementById("modalTabVitals");
    const modalTabReport = document.getElementById("modalTabReport");
    const modalTabHistory = document.getElementById("modalTabHistory");
    const modalPanelVitals = document.getElementById("modalPanelVitals");
    const modalPanelReport = document.getElementById("modalPanelReport");
    const modalPanelHistory = document.getElementById("modalPanelHistory");

    // Modal data bindings
    const modalPatName = document.getElementById("modalPatientName");
    const modalPatSub = document.getElementById("modalPatientSub");
    const modalGender = document.getElementById("modalGender");
    const modalAge = document.getElementById("modalAge");
    const modalBloodGroup = document.getElementById("modalBloodGroup");
    const modalPhone = document.getElementById("modalPhone");
    const modalEmail = document.getElementById("modalEmail");

    const modalBmi = document.getElementById("modalBmi");
    const modalBp = document.getElementById("modalBp");
    const modalGlucose = document.getElementById("modalGlucose");
    const modalPulse = document.getElementById("modalPulse");

    const modalRiskHeart = document.getElementById("modalRiskHeart");
    const modalRiskHeartBar = document.getElementById("modalRiskHeartBar");
    const modalRiskDiabetes = document.getElementById("modalRiskDiabetes");
    const modalRiskDiabetesBar = document.getElementById("modalRiskDiabetesBar");
    const modalRiskStroke = document.getElementById("modalRiskStroke");
    const modalRiskStrokeBar = document.getElementById("modalRiskStrokeBar");

    // Specialist clinical report creator form
    const createReportForm = document.getElementById("createReportForm");
    const reportDiagnosis = document.getElementById("reportDiagnosis");
    const reportPrescription = document.getElementById("reportPrescription");
    const reportRecommendations = document.getElementById("reportRecommendations");

    // Rescheduling & Telehealth Consultation Modal
    const consultationModal = document.getElementById("consultationModal");
    const btnExitConsultationModal = document.getElementById("btnExitConsultationModal");
    const btnCancelConsultationModal = document.getElementById("btnCancelConsultationModal");
    const consultationDetailsForm = document.getElementById("consultationDetailsForm");
    const consultationAppId = document.getElementById("consultationAppId");
    const consultationDate = document.getElementById("consultationDate");
    const consultationNotes = document.getElementById("consultationNotes");
    const consultationVideo = document.getElementById("consultationVideo");
    const btnSaveConsultationDetails = document.getElementById("btnSaveConsultationDetails");

    let patientsCache = [];
    let appointmentsCache = [];
    let activeAuditedPatientId = null;
    let activePatientHistory = [];
    let activePatientLatestScan = null;

    // Load Clinical Directories & Calculate aggregate stats
    async function loadDirectory() {
        try {
            const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
            const retrievingLogsText = window.i18n ? window.i18n.translateText("retrieving_patient_logs", activeLang) : "Retrieving database patient logs...";
            directoryBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i> ${retrievingLogsText}
                    </td>
                </tr>
            `;

            // Query all patients from Firestore patients collection
            const patientsSnap = await getDocs(collection(db, "patients"));
            
            patientsCache = [];
            patientsSnap.forEach((patSnap) => {
                const pData = patSnap.data();
                patientsCache.push({ id: patSnap.id, ...pData });
            });

            if (patientsCache.length === 0) {
                directoryBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> ${activeLang === "mr" ? "प्लॅटफॉर्मवर कोणतेही रुग्ण नोंदणीकृत नाहीत." : activeLang === "hi" ? "प्लेटफॉर्म पर कोई मरीज पंजीकृत नहीं है।" : "No patients registered on the platform."}
                        </td>
                    </tr>
                `;
                return;
            }

            // Draw Statistics widgets
            const countPatients = patientsCache.length;
            const countHighRisk = patientsCache.filter(p => p.lastRiskLevel === "High").length;
            
            document.getElementById("doctorStatPatients").textContent = countPatients;
            document.getElementById("doctorStatHighRisk").textContent = countHighRisk;

            // Fetch aggregate audit scans count from root healthRecords collection
            const recordsSnap = await getDocs(collection(db, "healthRecords"));
            document.getElementById("doctorStatScans").textContent = recordsSnap.size;

            // Populate table rows
            renderDirectoryTable(patientsCache);

        } catch (err) {
            console.error("Clinical Directory Retrieval Error: ", err);
            const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
            const failedText = activeLang === "mr" ? "रुग्ण नोंदी मिळवण्यात अयशस्वी" : activeLang === "hi" ? "नैदानिक लॉग प्राप्त करने में विफल" : "Failed to retrieve clinical logs";
            directoryBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--color-danger); padding: 35px 0;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.8rem; margin-bottom: 8px;"></i>
                        ${failedText}: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // Render Table Directory Rows
    function renderDirectoryTable(patients) {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        const notAssessedText = window.i18n ? window.i18n.translateText("not_evaluated", activeLang) : "Not Evaluated";
        const yrsLabel = activeLang === "mr" ? "वर्षे" : activeLang === "hi" ? "वर्ष" : "Yrs";
        const auditBtnText = window.i18n ? window.i18n.translateText("audit", activeLang) : "Audit";

        directoryBody.innerHTML = patients.map(p => {
            const lastActive = p.lastAssessmentDate 
                ? new Date(p.lastAssessmentDate).toLocaleDateString(activeLang === "mr" ? "mr-IN" : activeLang === "hi" ? "hi-IN" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                : notAssessedText;
            
            const scoreDisplay = p.lastHealthScore 
                ? `<span style="font-weight:600; color:${p.lastHealthScore >= 80 ? 'var(--color-success)' : p.lastHealthScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'};">${p.lastHealthScore}/100</span>`
                : "--";
                
            let riskClass = "low";
            let riskLabelKey = "low_risk";
            if (p.lastRiskLevel === "High") { riskClass = "high"; riskLabelKey = "high_risk"; }
            else if (p.lastRiskLevel === "Medium") { riskClass = "medium"; riskLabelKey = "medium_risk"; }
            else if (!p.lastRiskLevel) { riskClass = "low"; riskLabelKey = "no_scan_run"; }

            const riskLabel = window.i18n ? window.i18n.translateText(riskLabelKey, activeLang) : (p.lastRiskLevel || "Not Scanned");
            const displayName = p.name || (p.email ? p.email.split("@")[0] : 'Anonymous Patient');

            return `
                <tr class="patient-row">
                    <td><span class="metric-badge primary" style="font-family: monospace; font-weight: 700;">REG-${p.id.slice(0, 6).toUpperCase()}</span></td>
                    <td style="font-weight: 600;"><i class="fa-regular fa-user" style="margin-right: 8px; color: var(--text-muted);"></i> ${displayName}</td>
                    <td><span class="metric-badge success" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-card); font-weight:600;">${p.bloodGroup || '--'}</span></td>
                    <td id="tableAge_${p.id}">${p.age ? `${p.age} ${yrsLabel}` : '--'}</td>
                    <td style="color: var(--text-secondary);">${lastActive}</td>
                    <td>${scoreDisplay}</td>
                    <td><span class="badge-risk ${riskClass}">${riskLabel}</span></td>
                    <td>
                        <button class="btn-primary audit-patient-btn" data-id="${p.id}" style="padding: 6px 14px; font-size: 0.775rem; border-radius: 6px; gap: 6px;">
                            <i class="fa-solid fa-stethoscope"></i> ${auditBtnText}
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Attach click listeners to Audit buttons
        document.querySelectorAll(".audit-patient-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const patId = btn.getAttribute("data-id");
                openAuditingModal(patId);
            });
        });
    }

    // Filter directory via search input
    searchInput.addEventListener("input", (e) => {
        const queryVal = e.target.value.toLowerCase().trim();
        const filtered = patientsCache.filter(p => {
            const nameMatch = (p.name || "").toLowerCase().includes(queryVal);
            const emailMatch = (p.email || "").toLowerCase().includes(queryVal);
            return nameMatch || emailMatch;
        });
        renderDirectoryTable(filtered);
    });

    // 3. Appointment Auditing Controls
    async function loadDoctorAppointments() {
        try {
            const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
            appointmentsBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                        <i class="fa-solid fa-spinner fa-spin"></i> ${activeLang === "mr" ? "अपॉइंटमेंट नोंदी लोड होत आहेत..." : activeLang === "hi" ? "अपॉइंटमेंट लॉग लोड हो रहे हैं..." : "Loading appointment logs..."}
                    </td>
                </tr>
            `;

            // Query appointments matching Doctor UID
            const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
            const snap = await getDocs(q);

            if (snap.empty) {
                appointmentsCache = [];
                appointmentsBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                            ${activeLang === "mr" ? "नोंदवलेली कोणतीही सल्लामसलत आढळली नाही." : activeLang === "hi" ? "कैटलॉग पर कोई अनुरोधित यात्रा नहीं है।" : "No requested visits on catalog."}
                        </td>
                    </tr>
                `;
                return;
            }

            const apps = [];
            snap.forEach((docSnap) => {
                apps.push({ id: docSnap.id, ...docSnap.data() });
            });
            // Sort chronologically
            apps.sort((a, b) => new Date(a.date) - new Date(b.date));

            appointmentsCache = [...apps];

            renderAppointmentsTable(appointmentsCache);

        } catch (err) {
            console.error("Failed to load doctor appointments: ", err);
            const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
            appointmentsBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--color-danger); padding: 20px 0;">
                    </td>
                </tr>
            `;
        }
    }

    function renderAppointmentsTable(apps) {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        
        if (apps.length === 0) {
            appointmentsBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                        ${activeLang === "mr" ? "नोंदवलेली कोणतीही सल्लामसलत आढळली नाही." : activeLang === "hi" ? "कैटलॉग पर कोई अनुरोधित यात्रा नहीं है।" : "No requested visits on catalog."}
                    </td>
                </tr>
            `;
            return;
        }

        appointmentsBody.innerHTML = apps.map(app => {
            const ad = new Date(app.date);
            const fd = ad.toLocaleDateString(activeLang === "mr" ? "mr-IN" : activeLang === "hi" ? "hi-IN" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
            
            let badgeClass = "pending";
            if (app.status === "approved") badgeClass = "approved";
            else if (app.status === "cancelled") badgeClass = "cancelled";
            else if (app.status === "rescheduled") badgeClass = "approved";

            let noteBadge = app.doctorNotes ? `<div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 4px; font-style: italic;"><i class="fa-solid fa-pen-nib"></i> ${app.doctorNotes}</div>` : "";
            
            const joinVideoText = activeLang === "mr" ? "लाइव्ह व्हिडिओमध्ये सामील व्हा" : activeLang === "hi" ? "लाइव वीडियो में शामिल हों" : "Join Live Video";
            let videoBadge = app.videoLink ? `<div style="margin-top: 4px;"><a href="${app.videoLink}" target="_blank" style="font-size:0.7rem; color: var(--color-accent); text-decoration: none;"><i class="fa-solid fa-video"></i> ${joinVideoText}</a></div>` : "";

            const approveText = activeLang === "mr" ? "मंजूर करा" : activeLang === "hi" ? "स्वीकार करें" : "Approve";
            const cancelText = activeLang === "mr" ? "रद्द करा" : activeLang === "hi" ? "रद्द करें" : "Cancel";
            const auditedText = activeLang === "mr" ? "ऑडिट केले" : activeLang === "hi" ? "ऑडिट किया गया" : "Audited";

            // Action buttons only for PENDING items
            const actionCell = app.status === "pending"
                ? `<div style="display: flex; gap: 8px;">
                       <button class="btn-primary approve-btn" data-id="${app.id}" style="padding: 4px 10px; font-size: 0.725rem; border-radius: 4px; background:linear-gradient(135deg, var(--color-success), var(--color-secondary));"><i class="fa-regular fa-calendar-check"></i> ${approveText}</button>
                       <button class="btn-outline cancel-btn" data-id="${app.id}" style="padding: 4px 10px; font-size: 0.725rem; border-radius: 4px; border-color:var(--color-danger); color:var(--color-danger); background:rgba(239, 68, 68, 0.02);"><i class="fa-regular fa-calendar-times"></i> ${cancelText}</button>
                   </div>`
                : `<span style="font-size:0.75rem; color:var(--text-muted);">${auditedText}</span>`;

            const statusText = getStatusLabel(app.status, activeLang);

            return `
                <tr>
                    <td style="font-weight: 500;">
                        <i class="fa-regular fa-user" style="color:var(--color-primary); margin-right:6px;"></i> ${app.patientName}
                        ${noteBadge}
                        ${videoBadge}
                    </td>
                    <td style="color: var(--text-secondary); font-size:0.8rem;">${fd}</td>
                    <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
                    <td>${actionCell}</td>
                </tr>
            `;
        }).join("");

        // Bind Approve/Cancel click listeners to trigger the Consultation Modal
        document.querySelectorAll(".approve-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const appId = btn.getAttribute("data-id");
                const app = appointmentsCache.find(a => a.id === appId);
                if (!app) return;

                consultationAppId.value = appId;
                if (app.date) {
                    try {
                        const d = new Date(app.date);
                        const tzoffset = d.getTimezoneOffset() * 60000;
                        const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
                        consultationDate.value = localISOTime;
                    } catch (e) {
                        consultationDate.value = "";
                    }
                } else {
                    consultationDate.value = "";
                }
                consultationNotes.value = app.doctorNotes || "";
                consultationVideo.value = app.videoLink || "";
                consultationDetailsForm.setAttribute("data-action", "approve");

                btnSaveConsultationDetails.style.background = "";
                const approveSyncText = activeLang === "mr" ? "मंजूर करा आणि तपशील सिंक करा" : activeLang === "hi" ? "स्वीकार करें और विवरण सिंक करें" : "Approve & Sync Details";
                btnSaveConsultationDetails.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${approveSyncText}`;
                consultationModal.style.display = "flex";
            });
        });

        document.querySelectorAll(".cancel-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const appId = btn.getAttribute("data-id");
                const app = appointmentsCache.find(a => a.id === appId);
                if (!app) return;

                consultationAppId.value = appId;
                consultationNotes.value = app.doctorNotes || "";
                consultationVideo.value = "";
                consultationDate.value = "";
                consultationDetailsForm.setAttribute("data-action", "cancel");

                btnSaveConsultationDetails.style.background = "var(--color-danger)";
                const cancelAppText = activeLang === "mr" ? "अपॉइंटमेंट रद्द करा" : activeLang === "hi" ? "अपॉइंटमेंट रद्द करें" : "Cancel Appointment";
                btnSaveConsultationDetails.innerHTML = `<i class="fa-regular fa-calendar-times"></i> ${cancelAppText}`;
                consultationModal.style.display = "flex";
            });
        });
    }

    // Close Consultation Modal
    function closeConsultationModal() {
        consultationModal.style.display = "none";
        consultationDetailsForm.reset();
    }

    if (btnExitConsultationModal) btnExitConsultationModal.addEventListener("click", closeConsultationModal);
    if (btnCancelConsultationModal) btnCancelConsultationModal.addEventListener("click", closeConsultationModal);

    // Save Consultation Details
    if (consultationDetailsForm) {
        consultationDetailsForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const appId = consultationAppId.value;
            const action = consultationDetailsForm.getAttribute("data-action");
            const newDate = consultationDate.value;
            const docNotes = consultationNotes.value.trim();
            const videoLink = consultationVideo.value.trim();

            const originalApp = appointmentsCache.find(a => a.id === appId);
            if (!originalApp) {
                alert("Consultation update failed: Appointment not found in cache.");
                return;
            }

            try {
                btnSaveConsultationDetails.disabled = true;
                btnSaveConsultationDetails.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...';

                let finalStatus = action === "cancel" ? "cancelled" : "approved";
                let targetDate = originalApp.date;

                if (action !== "cancel" && newDate) {
                    const parsedNewDate = new Date(newDate).toISOString();
                    const origDateObj = new Date(originalApp.date);
                    const newDateObj = new Date(newDate);
                    if (origDateObj.getTime() !== newDateObj.getTime()) {
                        finalStatus = "rescheduled";
                        targetDate = parsedNewDate;
                    }
                }

                // Update appointment document in Firestore
                const appRef = doc(db, "appointments", appId);
                const updatePayload = {
                    status: finalStatus,
                    doctorNotes: docNotes || null,
                    videoLink: videoLink || null
                };
                if (action !== "cancel" && newDate) {
                    updatePayload.date = targetDate;
                }

                await updateDoc(appRef, updatePayload);

                // Dispatch notification to patient
                const formattedDateDisplay = new Date(targetDate).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                });

                const docName = profileData.name || doctorName;
                await addDoc(collection(db, "notifications"), {
                    userId: originalApp.patientId,
                    title: "Appointment Status Updated",
                    message: `Dr. ${docName} has updated your consultation scheduled for ${formattedDateDisplay}. Status: ${finalStatus.toUpperCase()}.`,
                    timestamp: new Date().toISOString(),
                    read: false
                });

                alert(`Appointment successfully updated to status ${finalStatus.toUpperCase()}.`);
                closeConsultationModal();
                loadDoctorAppointments();

            } catch (err) {
                console.error("Consultation update failed: ", err);
                alert("Action failed: " + err.message);
            } finally {
                btnSaveConsultationDetails.disabled = false;
                if (action === "cancel") {
                    btnSaveConsultationDetails.innerHTML = '<i class="fa-regular fa-calendar-times"></i> Cancel Appointment';
                } else {
                    btnSaveConsultationDetails.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Approve & Sync Details';
                }
            }
        });
    }

    // 4. Auditing Modal Tabs switching logic
    if (modalTabVitals) {
        modalTabVitals.addEventListener("click", () => {
            modalTabVitals.classList.add("active");
            modalTabReport.classList.remove("active");
            modalTabHistory.classList.remove("active");
            modalPanelVitals.style.display = "block";
            modalPanelReport.style.display = "none";
            modalPanelHistory.style.display = "none";
        });
    }
    if (modalTabReport) {
        modalTabReport.addEventListener("click", () => {
            modalTabReport.classList.add("active");
            modalTabVitals.classList.remove("active");
            modalTabHistory.classList.remove("active");
            modalPanelReport.style.display = "block";
            modalPanelVitals.style.display = "none";
            modalPanelHistory.style.display = "none";
        });
    }
    if (modalTabHistory) {
        modalTabHistory.addEventListener("click", () => {
            modalTabHistory.classList.add("active");
            modalTabVitals.classList.remove("active");
            modalTabReport.classList.remove("active");
            modalPanelHistory.style.display = "block";
            modalPanelVitals.style.display = "none";
            modalPanelReport.style.display = "none";
        });
    }

    // Retrieve and Display patient detailed charts & vitals
    async function openAuditingModal(patientId) {
        const patient = patientsCache.find(p => p.id === patientId);
        if (!patient) return;

        activeAuditedPatientId = patient.id;
        
        // Reset and show modal tabs/fields
        modalTabVitals.classList.add("active");
        modalTabReport.classList.remove("active");
        modalTabHistory.classList.remove("active");
        modalPanelVitals.style.display = "block";
        modalPanelReport.style.display = "none";
        modalPanelHistory.style.display = "none";

        modalPatName.textContent = patient.name || (patient.email ? patient.email.split("@")[0] : "Anonymous Patient");
        modalGender.textContent = "--";
        modalAge.textContent = "--";
        modalBloodGroup.textContent = "--";
        modalPhone.textContent = "--";
        modalEmail.textContent = "--";

        modalBmi.textContent = "--";
        modalBp.textContent = "--";
        modalGlucose.textContent = "--";
        modalPulse.textContent = "--";

        modalRiskHeart.textContent = "--";
        modalRiskHeartBar.style.width = "0%";
        modalRiskDiabetes.textContent = "--";
        modalRiskDiabetesBar.style.width = "0%";
        modalRiskStroke.textContent = "--";
        modalRiskStrokeBar.style.width = "0%";

        const refBp = document.getElementById("refBp");
        const refGlucose = document.getElementById("refGlucose");
        const refPulse = document.getElementById("refPulse");
        const refBmi = document.getElementById("refBmi");
        const refSymptoms = document.getElementById("refSymptoms");
        const refRiskHeart = document.getElementById("refRiskHeart");
        const refRiskDiabetes = document.getElementById("refRiskDiabetes");
        const refRiskStroke = document.getElementById("refRiskStroke");

        if (refBp) refBp.textContent = "--";
        if (refGlucose) refGlucose.textContent = "--";
        if (refPulse) refPulse.textContent = "--";
        if (refBmi) refBmi.textContent = "--";
        if (refSymptoms) refSymptoms.textContent = "--";
        if (refRiskHeart) refRiskHeart.textContent = "--";
        if (refRiskDiabetes) refRiskDiabetes.textContent = "--";
        if (refRiskStroke) refRiskStroke.textContent = "--";

        feedbackText.value = patient.doctorNote || "";

        // Open Modal overlay
        auditModal.style.display = "flex";

        try {
            // Load patient historical timeline
            const historyBody = document.getElementById("modalPatientHistoryTable");
            const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                        <i class="fa-solid fa-spinner fa-spin"></i> ${activeLang === "mr" ? "इतिहास मूल्यमापन लोड होत आहे..." : activeLang === "hi" ? "इतिहास मूल्यांकन लोड हो रहा है..." : "Loading historical assessments..."}
                    </td>
                </tr>
            `;

            const historySnap = await getDocs(query(collection(db, "healthRecords"), where("patientId", "==", patient.id)));
            activePatientHistory = [];
            historySnap.forEach(snap => activePatientHistory.push(snap.data()));
            activePatientHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

            activePatientLatestScan = activePatientHistory.length > 0 ? activePatientHistory[0] : null;

            // Render content
            renderAuditingModalContent(patient);

        } catch (err) {
            console.error("Auditing modal load error: ", err);
            modalPatSub.textContent = "Error synchronising latest diagnostics logs: " + err.message;
        }
    }

    function renderAuditingModalContent(patient) {
        const activeLang = window.i18n ? window.i18n.getLanguage() : "en";
        const yearsLabel = activeLang === "mr" ? "वर्षे" : activeLang === "hi" ? "वर्ष" : "Years";
        
        const displayName = patient.name || (patient.email ? patient.email.split("@")[0] : "Anonymous Patient");
        modalPatName.textContent = displayName;
        
        let initialGender = patient.gender || "--";
        if (initialGender === "Male") initialGender = window.i18n ? window.i18n.translateText("gender_male", activeLang) : "Male";
        else if (initialGender === "Female") initialGender = window.i18n ? window.i18n.translateText("gender_female", activeLang) : "Female";
        else if (initialGender === "Other") initialGender = window.i18n ? window.i18n.translateText("gender_other", activeLang) : "Other";
        modalGender.textContent = initialGender;
        
        modalAge.textContent = patient.age ? `${patient.age} ${yearsLabel}` : "--";
        modalBloodGroup.textContent = patient.bloodGroup || "--";
        modalPhone.textContent = patient.phone || "--";
        modalEmail.textContent = patient.email || "--";

        // Historical table render
        const historyBody = document.getElementById("modalPatientHistoryTable");
        if (activePatientHistory.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
                        ${activeLang === "mr" ? "मागील कोणतेही मूल्यमापन उपलब्ध नाही." : activeLang === "hi" ? "कोई पूर्व मूल्यांकन उपलब्ध नहीं है।" : "No prior assessments on catalog."}
                    </td>
                </tr>
            `;
        } else {
            historyBody.innerHTML = activePatientHistory.map(rec => {
                const recDate = new Date(rec.date).toLocaleDateString(activeLang === "mr" ? "mr-IN" : activeLang === "hi" ? "hi-IN" : "en-US", { month: "short", day: "numeric", year: "numeric" });
                let riskClass = "low";
                if (rec.riskLevel === "High") riskClass = "high";
                else if (rec.riskLevel === "Medium") riskClass = "medium";
                
                let riskText = rec.riskLevel;
                if (rec.riskLevel === "High") riskText = window.i18n ? window.i18n.translateText("high_risk", activeLang) : "High Risk";
                else if (rec.riskLevel === "Medium") riskText = window.i18n ? window.i18n.translateText("medium_risk", activeLang) : "Medium Risk";
                else if (rec.riskLevel === "Low") riskText = window.i18n ? window.i18n.translateText("low_risk", activeLang) : "Low Risk";

                return `
                    <tr>
                        <td style="font-weight: 500;">${recDate}</td>
                        <td>
                            <span style="font-weight: 600; color: ${rec.healthScore >= 80 ? 'var(--color-success)' : rec.healthScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'};">
                                ${rec.healthScore}/100
                            </span>
                        </td>
                        <td style="color: var(--text-secondary);">${rec.predictedDisease}</td>
                        <td><span class="badge-risk ${riskClass}">${riskText}</span></td>
                    </tr>
                `;
            }).join("");
        }

        const refBp = document.getElementById("refBp");
        const refGlucose = document.getElementById("refGlucose");
        const refPulse = document.getElementById("refPulse");
        const refBmi = document.getElementById("refBmi");
        const refSymptoms = document.getElementById("refSymptoms");
        const refRiskHeart = document.getElementById("refRiskHeart");
        const refRiskDiabetes = document.getElementById("refRiskDiabetes");
        const refRiskStroke = document.getElementById("refRiskStroke");

        if (!activePatientLatestScan) {
            const noScanText = activeLang === "mr" ? "नोंदणीकृत सदस्य. कोणतेही निदान मूल्यमापन केले नाही." : activeLang === "hi" ? "पंजीकृत सदस्य। कोई नैदानिक मूल्यांकन नहीं किया गया है।" : "Registered member. Has not run any diagnostic assessments.";
            modalPatSub.textContent = noScanText;
            
            modalBmi.textContent = "--";
            modalBp.textContent = "--";
            modalGlucose.textContent = "--";
            modalPulse.textContent = "--";

            modalRiskHeart.textContent = "--";
            modalRiskHeartBar.style.width = "0%";
            modalRiskDiabetes.textContent = "--";
            modalRiskDiabetesBar.style.width = "0%";
            modalRiskStroke.textContent = "--";
            modalRiskStrokeBar.style.width = "0%";
            
            if (refBp) refBp.textContent = "--";
            if (refGlucose) refGlucose.textContent = "--";
            if (refPulse) refPulse.textContent = "--";
            if (refBmi) refBmi.textContent = "--";
            if (refSymptoms) refSymptoms.textContent = "--";
            if (refRiskHeart) refRiskHeart.textContent = "--";
            if (refRiskDiabetes) refRiskDiabetes.textContent = "--";
            if (refRiskStroke) refRiskStroke.textContent = "--";
            return;
        }

        const latestScan = activePatientLatestScan;
        const sd = new Date(latestScan.date);
        const formattedScanDate = sd.toLocaleDateString(activeLang === "mr" ? "mr-IN" : activeLang === "hi" ? "hi-IN" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const auditingDiagnosticsText = activeLang === "mr" ? `स्कॅनवरून निदानाचे परीक्षण केले ${formattedScanDate}` : activeLang === "hi" ? `स्कैन से निदान का ऑडिट ${formattedScanDate}` : `Auditing diagnostics from scan run on ${formattedScanDate}`;
        modalPatSub.textContent = auditingDiagnosticsText;

        // Vitals details translate
        let latestGender = latestScan.gender || "--";
        if (latestGender === "Male") latestGender = window.i18n ? window.i18n.translateText("gender_male", activeLang) : "Male";
        else if (latestGender === "Female") latestGender = window.i18n ? window.i18n.translateText("gender_female", activeLang) : "Female";
        else if (latestGender === "Other") latestGender = window.i18n ? window.i18n.translateText("gender_other", activeLang) : "Other";
        modalGender.textContent = latestGender;
        
        modalAge.textContent = latestScan.age ? `${latestScan.age} ${yearsLabel}` : "--";
        modalBloodGroup.textContent = latestScan.bloodGroup || "--";

        let bmiCatText = latestScan.bmiCategory || "";
        const bmiCatKey = bmiCatText ? bmiCatText.toLowerCase() : "";
        if (bmiCatKey && ["normal", "underweight", "overweight", "obese"].includes(bmiCatKey)) {
            bmiCatText = window.i18n ? window.i18n.translateText(bmiCatKey, activeLang) : bmiCatText;
        }
        modalBmi.textContent = `${latestScan.bmi} (${bmiCatText})`;
        modalBp.textContent = `${latestScan.systolic}/${latestScan.diastolic} mmHg`;
        modalGlucose.textContent = `${latestScan.glucose} mg/dL`;
        modalPulse.textContent = `${latestScan.heartRate} bpm`;

        // Risks
        modalRiskHeart.textContent = `${latestScan.risks.heart}%`;
        modalRiskHeartBar.style.width = `${latestScan.risks.heart}%`;
        modalRiskDiabetes.textContent = `${latestScan.risks.diabetes}%`;
        modalRiskDiabetesBar.style.width = `${latestScan.risks.diabetes}%`;
        modalRiskStroke.textContent = `${latestScan.risks.stroke}%`;
        modalRiskStrokeBar.style.width = `${latestScan.risks.stroke}%`;

        // Form reference
        if (refBp) refBp.textContent = `${latestScan.systolic}/${latestScan.diastolic} mmHg`;
        if (refGlucose) refGlucose.textContent = `${latestScan.glucose} mg/dL`;
        if (refPulse) refPulse.textContent = `${latestScan.heartRate} bpm`;
        if (refBmi) refBmi.textContent = `${latestScan.bmi} (${bmiCatText})`;
        
        const noSymptomsText = activeLang === "mr" ? "कोणतीही लक्षणे आढळली नाहीत" : activeLang === "hi" ? "कोई लक्षण रिपोर्ट नहीं किए गए" : "No symptoms reported";
        if (refSymptoms) {
            refSymptoms.textContent = (latestScan.symptoms && latestScan.symptoms.length > 0)
                ? latestScan.symptoms.join(", ")
                : noSymptomsText;
        }
        if (refRiskHeart) refRiskHeart.textContent = `${latestScan.risks.heart}%`;
        if (refRiskDiabetes) refRiskDiabetes.textContent = `${latestScan.risks.diabetes}%`;
        if (refRiskStroke) refRiskStroke.textContent = `${latestScan.risks.stroke}%`;
    }

    // Close Auditing Modal
    function closeAuditingModal() {
        auditModal.style.display = "none";
        activeAuditedPatientId = null;
        createReportForm.reset();
    }

    btnExitModal.addEventListener("click", closeAuditingModal);
    btnCancelModal.addEventListener("click", closeAuditingModal);

    // Save Clinician Vitals Care Notes
    if (saveAdviceBtn) {
        saveAdviceBtn.addEventListener("click", async () => {
            if (!activeAuditedPatientId) return;

            const note = feedbackText.value.trim();

            try {
                saveAdviceBtn.disabled = true;
                saveAdviceBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...';

                // Merge to patient's users collection document
                const userDocRef = doc(db, "users", activeAuditedPatientId);
                await updateDoc(userDocRef, {
                    doctorNote: note || null,
                    doctorNoteDate: note ? new Date().toISOString() : null
                });

                // Trigger merge to detailed patients collection as well to ensure data integrity
                const patientDocRef = doc(db, "patients", activeAuditedPatientId);
                await updateDoc(patientDocRef, {
                    doctorNote: note || null,
                    doctorNoteDate: note ? new Date().toISOString() : null
                });

                alert("Clinician care advice note successfully synchronized with patient dashboard.");
                closeAuditingModal();
                loadDirectory();

            } catch (err) {
                console.error("Clinical advice submit error: ", err);
                alert("Advice sync failed: " + err.message);
            } finally {
                saveAdviceBtn.disabled = false;
                saveAdviceBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Save Vitals Notes';
            }
        });
    }

    // Specialist clinical report form publishing workflow
    if (createReportForm) {
        createReportForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!activeAuditedPatientId) return;

            const diagnosis = reportDiagnosis.value.trim();
            const prescription = reportPrescription.value.trim();
            const recommendations = reportRecommendations.value.trim();
            const btnPublish = document.getElementById("btnPublishReport");

            const patient = patientsCache.find(p => p.id === activeAuditedPatientId);
            const patientName = patient ? (patient.name || (patient.email ? patient.email.split("@")[0] : "Anonymous Patient")) : "Anonymous Patient";

            try {
                btnPublish.disabled = true;
                btnPublish.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publishing...';

                const docName = profileData.name || doctorName;
                const clinic = profileData.clinicName || "Medical General Hospital";

                // Save to doctorReports collection
                await addDoc(collection(db, "doctorReports"), {
                    patientId: activeAuditedPatientId,
                    patientName: patientName,
                    doctorId: user.uid,
                    doctorName: docName,
                    clinicName: clinic,
                    diagnosis,
                    prescription,
                    recommendations,
                    published: true,
                    date: new Date().toISOString()
                });

                // Dispatch real-time notification to patient
                await addDoc(collection(db, "notifications"), {
                    userId: activeAuditedPatientId,
                    title: "New Specialist Report",
                    message: `Dr. ${docName} has published a new medical report for you.`,
                    timestamp: new Date().toISOString(),
                    read: false
                });

                alert("Specialist clinical report successfully published and dispatched to the patient.");
                closeAuditingModal();

            } catch (err) {
                console.error("Clinical report publishing failed: ", err);
                alert("Report publishing failed: " + err.message);
            } finally {
                btnPublish.disabled = false;
                btnPublish.innerHTML = '<i class="fa-solid fa-share-from-square"></i> Publish Specialist Report';
            }
        });
    }

    // ==========================================
    // Real-Time Notifications Hub (SOS alerts)
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
        
        dropdown.style.display = "none";
        dropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    // Listens in real-time to SOS broadcasts and critical alarms matching doctor UID
    const notifQuery = query(collection(db, "notifications"), where("userId", "in", [user.uid, "all_specialists"]));
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
                <div style="background: ${n.read ? 'rgba(255,255,255,0.01)' : 'rgba(239, 68, 68, 0.04)'}; border-left: 3px solid ${n.read ? 'transparent' : 'var(--color-danger)'}; padding: 10px; border-radius: var(--radius-sm); font-size: 0.775rem;">
                    <div style="font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: ${n.read ? 'var(--text-primary)' : 'var(--color-danger)'}; font-weight: 700;">${n.title}</span>
                        <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal;">${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div style="color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">${n.message}</div>
                </div>
            `).join("");
        }
    }, (err) => {
        console.error("SOS Alerts notification listener failed: ", err);
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

    // Connect language changed event handler to refresh dynamic state
    window.addEventListener("languagechanged", () => {
        greetDoctor();
        updateSpecialistProfileCard();
        renderDirectoryTable(patientsCache);
        renderAppointmentsTable(appointmentsCache);
        if (activeAuditedPatientId) {
            const patient = patientsCache.find(p => p.id === activeAuditedPatientId);
            if (patient) {
                renderAuditingModalContent(patient);
            }
        }
    });

    // Initialize all loaders
    loadDirectory();
    loadDoctorAppointments();
});
