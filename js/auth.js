import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Page security guard
export function checkAuth(onUserAuthenticated) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Not authenticated - redirect to login page
            const currentPath = window.location.pathname;
            if (!currentPath.includes("login.html") && !currentPath.includes("signup.html") && !currentPath.includes("index.html") && currentPath !== "/" && currentPath !== "") {
                window.location = "login.html";
            }
        } else {
            // Authenticated - fetch profile from firestore
            try {
                const userDocRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userDocRef);
                
                let profileData = {};
                if (docSnap.exists()) {
                    const basicData = docSnap.data();
                    profileData.role = basicData.role || "patient";
                    profileData.email = basicData.email || user.email;
                    
                    const profileDocRef = doc(db, profileData.role === "doctor" ? "doctors" : "patients", user.uid);
                    const profileSnap = await getDoc(profileDocRef);
                    if (profileSnap.exists()) {
                        profileData = { ...profileData, ...profileSnap.data() };
                    } else {
                        // Fallback if detail collection is not written yet
                        profileData = { ...profileData, ...basicData };
                    }
                } else {
                    profileData = { role: "patient", email: user.email };
                }
                
                // Route Protection Checks
                const currentPath = window.location.pathname;
                const role = profileData.role || "patient";
                
                if (role === "patient" && currentPath.includes("doctor-dashboard.html")) {
                    window.location = "dashboard.html";
                    return;
                }
                
                if (role === "doctor" && ((currentPath.includes("dashboard.html") && !currentPath.includes("doctor-dashboard.html")) || currentPath.includes("assessment.html") || currentPath.includes("analytics.html") || currentPath.includes("results.html"))) {
                    window.location = "doctor-dashboard.html";
                    return;
                }
                
                if (onUserAuthenticated) {
                    onUserAuthenticated(user, profileData);
                }
            } catch (err) {
                console.error("Error retrieving user profile: ", err);
                if (onUserAuthenticated) {
                    onUserAuthenticated(user, {});
                }
            }
        }
    });
}

// User logout trigger
export async function logoutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem("currentUser");
        window.location = "index.html";
    } catch (err) {
        console.error("Logout failed: ", err);
        alert("Sign out failed. Please try again.");
    }
}

// Setup common UI items (e.g., Theme setting, logout button hook)
document.addEventListener("DOMContentLoaded", () => {
    // Theme slider synchronization
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        const savedTheme = localStorage.getItem("theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        themeToggle.checked = savedTheme === "light";
        
        themeToggle.addEventListener("change", () => {
            const nextTheme = themeToggle.checked ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", nextTheme);
            localStorage.setItem("theme", nextTheme);
        });
    }

    // Connect any logout buttons
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
    
    // Sidebar responsive toggle (for mobile navigation drawer)
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".sidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }
});
