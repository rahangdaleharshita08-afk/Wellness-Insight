import { checkAuth } from "./auth.js";
import { auth, db } from "./firebase-config.js";
import { 
    doc, 
    updateDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

checkAuth(async (user, profileData) => {
    // DOM Elements
    const avatarNode = document.getElementById("sidebarAvatar");
    const nameNode = document.getElementById("sidebarName");
    const roleNode = document.getElementById("sidebarRole");
    const navNode = document.getElementById("profileSidebarNav");

    const form = document.getElementById("editProfileForm");
    const nameInput = document.getElementById("profileName");
    const phoneInput = document.getElementById("profilePhone");
    const roleInput = document.getElementById("profileRole");

    // Panels toggling
    const patientFields = document.getElementById("patientProfileFields");
    const doctorFields = document.getElementById("doctorProfileFields");
    const baselineCard = document.getElementById("baselineVitalsCard");
    const logsResetBox = document.getElementById("clinicalLogsResetContainer");

    const role = profileData.role || "patient";
    roleInput.value = role;

    // 1. Configure UI depending on Account Role
    if (role === "doctor") {
        // Adjust Doctor Sidebar Nav links
        roleNode.textContent = "Clinical Specialist";
        if (profileData.name) {
            nameNode.textContent = `Dr. ${profileData.name}`;
            avatarNode.textContent = profileData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        }
        navNode.innerHTML = `
            <a href="doctor-dashboard.html" class="nav-item"><i class="fa-solid fa-shield-halved"></i> Doctor Panel</a>
            <a href="profile.html" class="nav-item active"><i class="fa-solid fa-user-doctor"></i> My Profile</a>
        `;

        // Toggle Fields panels
        patientFields.style.display = "none";
        doctorFields.style.display = "block";
        baselineCard.style.display = "none";
        logsResetBox.style.display = "none";

        // Pre-populate Doctor specific fields
        if (profileData.name) nameInput.value = profileData.name;
        if (profileData.phone) phoneInput.value = profileData.phone;
        if (profileData.specialization) document.getElementById("profileSpecialization").value = profileData.specialization;
        if (profileData.experience) document.getElementById("profileExperience").value = profileData.experience;
        if (profileData.qualification) document.getElementById("profileQualification").value = profileData.qualification;
        if (profileData.clinicName) document.getElementById("profileClinicName").value = profileData.clinicName;
        if (profileData.licenseNumber) document.getElementById("profileLicenseNumber").value = profileData.licenseNumber;

    } else {
        // Adjust Patient Sidebar Nav links
        roleNode.textContent = "Patient Member";
        if (profileData.name) {
            nameNode.textContent = profileData.name;
            avatarNode.textContent = profileData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        }
        navNode.innerHTML = `
            <a href="dashboard.html" class="nav-item"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
            <a href="assessment.html" class="nav-item"><i class="fa-solid fa-stethoscope"></i> Health Wizard</a>
            <a href="analytics.html" class="nav-item"><i class="fa-solid fa-chart-line"></i> Risk Analytics</a>
            <a href="profile.html" class="nav-item active"><i class="fa-solid fa-user-doctor"></i> User Profile</a>
        `;

        // Toggle Fields panels
        patientFields.style.display = "block";
        doctorFields.style.display = "none";
        baselineCard.style.display = "block";
        logsResetBox.style.display = "block";

        // Pre-populate Patient specific fields
        if (profileData.name) nameInput.value = profileData.name;
        if (profileData.phone) phoneInput.value = profileData.phone;
        if (profileData.age) document.getElementById("profileAge").value = profileData.age;
        if (profileData.gender) document.getElementById("profileGender").value = profileData.gender;
        if (profileData.bloodGroup) document.getElementById("profileBloodGroup").value = profileData.bloodGroup;
        if (profileData.address) document.getElementById("profileAddress").value = profileData.address;
        if (profileData.medicalHistory) document.getElementById("profileMedicalHistory").value = profileData.medicalHistory;
        if (profileData.emergencyContactName) document.getElementById("profileEmergencyName").value = profileData.emergencyContactName;
        if (profileData.emergencyContactRelation) document.getElementById("profileEmergencyRelation").value = profileData.emergencyContactRelation;
        if (profileData.emergencyContactPhone) document.getElementById("profileEmergencyPhone").value = profileData.emergencyContactPhone;

        // Load Baseline Biological metrics
        const ageNode = document.getElementById("baseAge");
        const genderNode = document.getElementById("baseGender");
        const glucNode = document.getElementById("baseGlucose");
        const heightNode = document.getElementById("baseHeight");
        const weightNode = document.getElementById("baseWeight");
        const bmiNode = document.getElementById("baseBmi");

        try {
            // Query latest health records from root healthRecords collection
            const q = query(collection(db, "healthRecords"), where("patientId", "==", user.uid));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const records = [];
                snapshot.forEach(docSnap => records.push(docSnap.data()));
                records.sort((a,b) => new Date(b.date) - new Date(a.date));
                const latest = records[0];

                ageNode.textContent = `${latest.age} Years`;
                genderNode.textContent = latest.gender;
                glucNode.textContent = `${latest.glucose} mg/dL`;
                heightNode.textContent = `${latest.height} cm`;
                weightNode.textContent = `${latest.weight} kg`;
                bmiNode.textContent = `${latest.bmi} (${latest.bmiCategory})`;
            } else {
                ageNode.textContent = "Not assessed yet";
                genderNode.textContent = "Not assessed yet";
                glucNode.textContent = "Not assessed yet";
                heightNode.textContent = "Not assessed yet";
                weightNode.textContent = "Not assessed yet";
                bmiNode.textContent = "Not assessed yet";
            }
        } catch (err) {
            console.error("Baseline loading error: ", err);
        }
    }

    // 2. Edit Profile Form Submission Logic
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const saveBtn = document.getElementById("btnSaveProfile");
            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            
            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
                
                const userDocRef = doc(db, "users", user.uid);
                const profileDocRef = doc(db, role === "doctor" ? "doctors" : "patients", user.uid);
                let updatePayload = { name, phone };

                if (role === "patient") {
                    const age = document.getElementById("profileAge").value;
                    const gender = document.getElementById("profileGender").value;
                    const bloodGroup = document.getElementById("profileBloodGroup").value;
                    const address = document.getElementById("profileAddress").value.trim();
                    const medicalHistory = document.getElementById("profileMedicalHistory").value.trim();
                    const emergencyContactName = document.getElementById("profileEmergencyName").value.trim();
                    const emergencyContactRelation = document.getElementById("profileEmergencyRelation").value.trim();
                    const emergencyContactPhone = document.getElementById("profileEmergencyPhone").value.trim();

                    updatePayload = {
                        ...updatePayload,
                        age: parseInt(age) || null,
                        gender,
                        bloodGroup,
                        address,
                        medicalHistory,
                        emergencyContactName,
                        emergencyContactRelation,
                        emergencyContactPhone
                    };
                } else if (role === "doctor") {
                    const specialization = document.getElementById("profileSpecialization").value.trim();
                    const experience = document.getElementById("profileExperience").value;
                    const qualification = document.getElementById("profileQualification").value.trim();
                    const clinicName = document.getElementById("profileClinicName").value.trim();
                    const licenseNumber = document.getElementById("profileLicenseNumber").value.trim();

                    updatePayload = {
                        ...updatePayload,
                        specialization,
                        experience: parseInt(experience) || null,
                        qualification,
                        clinicName,
                        licenseNumber
                    };
                }

                // Import setDoc from firebase-firestore
                // Sync core fields to users document
                await updateDoc(userDocRef, { name, phone });
                // Merge complete profile attributes into detailed collections
                await setDoc(profileDocRef, updatePayload, { merge: true });
                
                alert("Profile changes successfully updated.");
                
                // Sync sidebar displays
                if (role === "doctor") {
                    nameNode.textContent = `Dr. ${name}`;
                } else {
                    nameNode.textContent = name;
                }
                avatarNode.textContent = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

            } catch (err) {
                console.error("Profile Save Error: ", err);
                alert("Failed to update profile: " + err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save Changes';
            }
        });
    }

    // 3. Password Reset Email Trigger
    const resetBtn = document.getElementById("btnResetPassword");
    if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
            if (!user.email) return;
            
            try {
                resetBtn.disabled = true;
                resetBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Dispatched...';
                
                await sendPasswordResetEmail(auth, user.email);
                alert(`A password reset link has been dispatched to: ${user.email}. Please follow the instructions in the email to set a new password.`);
            } catch (err) {
                console.error("Password Reset Error: ", err);
                alert("Failed to dispatch reset email: " + err.message);
            } finally {
                resetBtn.disabled = false;
                resetBtn.innerHTML = '<i class="fa-solid fa-key"></i> Reset Password';
            }
        });
    }

    // 4. Clear Clinical Logs from root healthRecords collection
    const clearBtn = document.getElementById("btnClearLogs");
    if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
            const confirm1 = confirm("Are you sure you want to clear all historical assessment and risk scores? This action cannot be undone.");
            if (!confirm1) return;
            
            const confirm2 = confirm("Confirming deletion: All diagnostic logs will be wiped permanently from HIPAA-compliant servers. Proceed?");
            if (!confirm2) return;
            
            try {
                clearBtn.disabled = true;
                clearBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Wiping Database...';
                
                // Clear prediction shortcut
                localStorage.removeItem("lastPredictionId");
                
                // Query all records in healthRecords collection matching patientId
                const q = query(collection(db, "healthRecords"), where("patientId", "==", user.uid));
                const snapshot = await getDocs(q);
                
                // Loop and delete each document
                const deletePromises = [];
                snapshot.forEach((docSnap) => {
                    const docToDelRef = doc(db, "healthRecords", docSnap.id);
                    deletePromises.push(deleteDoc(docToDelRef));
                });
                
                await Promise.all(deletePromises);
                
                // Reset user root indicators back to null
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    lastHealthScore: null,
                    lastBmi: null,
                    lastBmiCategory: null,
                    lastSystolic: null,
                    lastDiastolic: null,
                    lastGlucose: null,
                    lastHeartRate: null,
                    lastRiskLevel: null,
                    lastPredictedDisease: null,
                    lastAssessmentDate: null
                });
                
                alert("Clinical history cleared successfully.");
                window.location = "dashboard.html";
                
            } catch (err) {
                console.error("Wipe Database Error: ", err);
                alert("Wipe failed: " + err.message);
            } finally {
                clearBtn.disabled = false;
                clearBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i> Clear Clinical Logs';
            }
        });
    }
});
