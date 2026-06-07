import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Handle Forgot Password Click
const forgotBtn = document.getElementById("forgotPasswordBtn");
if (forgotBtn) {
    forgotBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        if (!email) {
            alert("Please enter your email address in the Email field first to trigger a password reset.");
            return;
        }
        try {
            forgotBtn.innerHTML = "Sending...";
            forgotBtn.style.pointerEvents = "none";
            await sendPasswordResetEmail(auth, email);
            alert(`A password reset link has been dispatched to: ${email}. Please follow the instructions in the email.`);
        } catch (err) {
            console.error("Password reset error: ", err);
            alert("Failed to send reset email: " + err.message);
        } finally {
            forgotBtn.innerHTML = "Forgot Password?";
            forgotBtn.style.pointerEvents = "auto";
        }
    });
}

// Handle Email/Password Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const expectedRole = document.getElementById("loginRole").value;
        const submitBtn = loginForm.querySelector("button[type='submit']");
        
        try {
            // Set loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Query user role in Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);
            
            let actualRole = "patient";
            if (userSnap.exists()) {
                actualRole = userSnap.data().role || "patient";
            }
            
            // Enforce Role Match Checks
            if (expectedRole !== actualRole) {
                // Mismatch detected - Sign out and throw error
                await signOut(auth);
                
                let warningMessage = "Account role mismatch. Please select the correct login tab.";
                if (actualRole === "doctor") {
                    warningMessage = "This email is registered as a Healthcare Doctor. Please select the Doctor Login tab.";
                } else if (actualRole === "patient") {
                    warningMessage = "This email is registered as a Patient. Please select the Patient Login tab.";
                }
                
                throw { code: "custom/role-mismatch", message: warningMessage };
            }
            
            // Route dynamically based on role
            if (actualRole === "doctor") {
                window.location = "doctor-dashboard.html";
            } else {
                window.location = "dashboard.html";
            }
        } catch (err) {
            console.error("Login Error: ", err);
            let userFriendlyMessage = "Invalid credentials. Please verify your email and password.";
            
            if (err.code === "custom/role-mismatch") {
                userFriendlyMessage = err.message;
            } else if (err.code === "auth/invalid-email") {
                userFriendlyMessage = "The email address format is invalid.";
            } else if (err.code === "auth/user-disabled") {
                userFriendlyMessage = "This clinical account has been disabled.";
            } else if (err.code === "auth/user-not-found") {
                userFriendlyMessage = "No account found matching this email.";
            } else if (err.code === "auth/wrong-password") {
                userFriendlyMessage = "Incorrect password. Please try again.";
            } else if (err.code === "auth/invalid-credential") {
                userFriendlyMessage = "Incorrect email or password. Please verify your entries.";
            }
            
            alert(userFriendlyMessage);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In';
        }
    });
}

// Handle Google Authentication Popups (Only for Patients)
const googleLoginBtn = document.getElementById("googleLogin");
if (googleLoginBtn) {
    const provider = new GoogleAuthProvider();
    
    googleLoginBtn.addEventListener("click", async () => {
        try {
            googleLoginBtn.disabled = true;
            googleLoginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting...';
            
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            
            // Query user profile
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);
            
            let role = "patient";
            if (userSnap.exists()) {
                role = userSnap.data().role || "patient";
                
                // Google Sign-In is only allowed for Patient accounts in our model
                if (role !== "patient") {
                    await signOut(auth);
                    throw { code: "custom/role-mismatch", message: "Google Sign-In is reserved exclusively for Patient accounts." };
                }
            } else {
                // If Google user has no firestore record, create a default Patient record
                await setDoc(userDocRef, {
                    uid: user.uid,
                    role: "patient",
                    email: user.email
                });
                
                await setDoc(doc(db, "patients", user.uid), {
                    name: user.displayName || user.email.split("@")[0],
                    email: user.email,
                    bloodGroup: "",
                    phone: user.phoneNumber || "",
                    role: "patient",
                    createdAt: new Date().toISOString()
                });
            }
            
            window.location = "dashboard.html";
        } catch (err) {
            console.error("Google Login Error: ", err);
            if (err.code === "custom/role-mismatch") {
                alert(err.message);
            } else if (err.code !== "auth/popup-closed-by-user") {
                alert("Google Sign-In failed: " + err.message);
            }
        } finally {
            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML = '<img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google Logo"> Sign in with Google';
        }
    });
}