import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const role = document.getElementById("accountRole").value;
        const submitBtn = signupForm.querySelector("button[type='submit']");

        try {
            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating Profile...';

            // Create Authentication credentials
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            // Differentiate Profile information based on registration Role
            let profilePayload = {
                name,
                email,
                phone,
                role,
                createdAt: new Date().toISOString()
            };

            if (role === "patient") {
                const age = document.getElementById("age").value;
                const gender = document.getElementById("gender").value;
                const bloodGroup = document.getElementById("bloodGroup").value;
                const address = document.getElementById("address").value.trim();

                profilePayload = {
                    ...profilePayload,
                    age: parseInt(age),
                    gender,
                    bloodGroup,
                    address
                };
            } else if (role === "doctor") {
                const specialization = document.getElementById("specialization").value.trim();
                const experience = document.getElementById("experience").value;
                const clinicName = document.getElementById("clinicName").value.trim();
                const licenseNumber = document.getElementById("licenseNumber").value.trim();

                profilePayload = {
                    ...profilePayload,
                    specialization,
                    experience: parseInt(experience),
                    clinicName,
                    licenseNumber
                };
            }

            // Sync user details to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                role: role,
                email: email
            });
            
            // Write full profile data to role-specific collections
            await setDoc(doc(db, role === "doctor" ? "doctors" : "patients", user.uid), profilePayload);

            alert("Registration Successful!");
            
            // Redirect conditionally based on active role
            if (role === "doctor") {
                window.location = "doctor-dashboard.html";
            } else {
                window.location = "dashboard.html";
            }
        } catch (err) {
            console.error("Signup Error: ", err);
            let errorMessage = "Registration failed. Please try again.";
            
            if (err.code === "auth/email-already-in-use") {
                errorMessage = "This email is already associated with an account.";
            } else if (err.code === "auth/invalid-email") {
                errorMessage = "The email address entered is formatted incorrectly.";
            } else if (err.code === "auth/operation-not-allowed") {
                errorMessage = "Email/password accounts are disabled.";
            } else if (err.code === "auth/weak-password") {
                errorMessage = "Password is too weak. Please choose at least 6 characters.";
            }
            
            alert(errorMessage);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
        }
    });
}