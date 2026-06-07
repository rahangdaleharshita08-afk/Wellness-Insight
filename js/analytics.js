import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    where
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

    const gridNode = document.getElementById("analyticsGrid");
    const warningNode = document.getElementById("noDataWarning");

    try {
        // 1. Fetch historical assessment records from root healthRecords collection
        const predictionsColRef = collection(db, "healthRecords");
        const predictionsQuery = query(predictionsColRef, where("patientId", "==", user.uid));
        const snapshot = await getDocs(predictionsQuery);

        if (snapshot.empty) {
            gridNode.style.display = "none";
            warningNode.style.display = "block";
            return;
        }

        gridNode.style.display = "grid";
        warningNode.style.display = "none";

        const predictions = [];
        snapshot.forEach((docSnap) => {
            predictions.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // Sort chronologically (Oldest to Newest for Line trends chart)
        predictions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Latest assessment for Radar and Doughnut
        const latest = predictions[predictions.length - 1];

        // Compute Style Context Colors based on Theme
        function getThemeColors() {
            const isLight = document.documentElement.getAttribute("data-theme") === "light";
            return {
                text: isLight ? "#475569" : "#9ca3af",
                grid: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.05)",
                tooltipBg: isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(17, 24, 39, 0.95)",
                tooltipBorder: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                radialBg: isLight ? "rgba(37, 99, 235, 0.03)" : "rgba(59, 130, 246, 0.03)",
                radarAngleLine: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"
            };
        }

        let themeColors = getThemeColors();

        // 2. Render Health Trends Time-Series Chart (Line)
        const dates = predictions.map(p => {
            const d = new Date(p.date);
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        });
        const scores = predictions.map(p => p.healthScore);
        const bmis = predictions.map(p => p.bmi);

        const trendCtx = document.getElementById("healthTrendChart").getContext("2d");
        const trendChart = new Chart(trendCtx, {
            type: "line",
            data: {
                labels: dates,
                datasets: [
                    {
                        label: "Overall Health Index",
                        data: scores,
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        borderWidth: 3,
                        pointBackgroundColor: "#3b82f6",
                        pointBorderColor: "#fff",
                        pointHoverRadius: 7,
                        tension: 0.35,
                        fill: true,
                        yAxisID: "y"
                    },
                    {
                        label: "BMI Profile",
                        data: bmis,
                        borderColor: "#0d9488",
                        backgroundColor: "transparent",
                        borderWidth: 2,
                        pointBackgroundColor: "#0d9488",
                        pointBorderColor: "#fff",
                        pointHoverRadius: 6,
                        borderDash: [5, 5],
                        tension: 0.3,
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: { color: themeColors.text, font: { family: "Poppins", weight: 500 } }
                    },
                    tooltip: {
                        backgroundColor: themeColors.tooltipBg,
                        titleColor: themeColors.text,
                        bodyColor: themeColors.text,
                        borderColor: themeColors.tooltipBorder,
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: themeColors.grid },
                        ticks: { color: themeColors.text }
                    },
                    y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        min: 0,
                        max: 100,
                        grid: { color: themeColors.grid },
                        ticks: { color: themeColors.text },
                        title: { display: true, text: "Health Score (0-100)", color: themeColors.text }
                    },
                    y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        min: 10,
                        max: 40,
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: themeColors.text },
                        title: { display: true, text: "Body Mass Index (BMI)", color: themeColors.text }
                    }
                }
            }
        });

        // 3. Render Multi-Disease Risk Profiler (Radar)
        const radarCtx = document.getElementById("radarRiskChart").getContext("2d");
        const radarChart = new Chart(radarCtx, {
            type: "radar",
            data: {
                labels: ["Cardiovascular", "Type 2 Diabetes", "Stroke Risk", "Hypertension"],
                datasets: [{
                    label: "Calculated Risk Score (%)",
                    data: [
                        latest.risks.heart,
                        latest.risks.diabetes,
                        latest.risks.stroke,
                        latest.risks.hypertension
                    ],
                    backgroundColor: "rgba(139, 92, 246, 0.2)",
                    borderColor: "#8b5cf6",
                    borderWidth: 3,
                    pointBackgroundColor: "#8b5cf6",
                    pointBorderColor: "#fff",
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: themeColors.tooltipBg,
                        titleColor: themeColors.text,
                        bodyColor: themeColors.text,
                        borderColor: themeColors.tooltipBorder,
                        borderWidth: 1
                    }
                },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        grid: { color: themeColors.grid },
                        angleLines: { color: themeColors.radarAngleLine },
                        pointLabels: {
                            color: themeColors.text,
                            font: { family: "Poppins", size: 11, weight: 600 }
                        },
                        ticks: {
                            display: false,
                            stepSize: 20
                        }
                    }
                }
            }
        });

        // 4. Render Diagnostic Component Breakdown (Doughnut)
        let bpContribution = latest.systolic >= 120 ? Math.round(latest.systolic * 0.4) : 20;
        let glucContribution = latest.glucose >= 100 ? Math.round(latest.glucose * 0.3) : 25;
        let bmiContribution = latest.bmi >= 25 ? Math.round(latest.bmi * 1.5) : 15;
        
        let lifestyleScore = 15; 
        if (latest.smoking === "active") lifestyleScore += 30;
        if (latest.alcohol === "regular") lifestyleScore += 20;
        if (latest.activity === "sedentary") lifestyleScore += 15;

        const doughnutCtx = document.getElementById("doughnutRiskChart").getContext("2d");
        const doughnutChart = new Chart(doughnutCtx, {
            type: "doughnut",
            data: {
                labels: ["Blood Pressure Strain", "Sugar Levels", "Metabolic Weight (BMI)", "Lifestyle Choices"],
                datasets: [{
                    data: [bpContribution, glucContribution, bmiContribution, lifestyleScore],
                    backgroundColor: [
                        "rgba(239, 68, 68, 0.7)",  
                        "rgba(245, 158, 11, 0.7)",  
                        "rgba(59, 130, 246, 0.7)",  
                        "rgba(13, 148, 136, 0.7)"   
                    ],
                    borderColor: "transparent",
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: themeColors.text,
                            font: { family: "Inter", size: 11 },
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: themeColors.tooltipBg,
                        titleColor: themeColors.text,
                        bodyColor: themeColors.text,
                        borderColor: themeColors.tooltipBorder,
                        borderWidth: 1
                    }
                },
                cutout: "70%" 
            }
        });

        // 5. Listen to Theme Changes and update Chart layouts
        const themeToggle = document.getElementById("themeToggle");
        if (themeToggle) {
            themeToggle.addEventListener("change", () => {
                setTimeout(() => {
                    themeColors = getThemeColors();
                    
                    trendChart.options.plugins.legend.labels.color = themeColors.text;
                    trendChart.options.plugins.tooltip.backgroundColor = themeColors.tooltipBg;
                    trendChart.options.plugins.tooltip.titleColor = themeColors.text;
                    trendChart.options.plugins.tooltip.bodyColor = themeColors.text;
                    trendChart.options.plugins.tooltip.borderColor = themeColors.tooltipBorder;
                    trendChart.options.scales.x.grid.color = themeColors.grid;
                    trendChart.options.scales.x.ticks.color = themeColors.text;
                    trendChart.options.scales.y.grid.color = themeColors.grid;
                    trendChart.options.scales.y.ticks.color = themeColors.text;
                    trendChart.options.scales.y.title.color = themeColors.text;
                    trendChart.options.scales.y1.ticks.color = themeColors.text;
                    trendChart.options.scales.y1.title.color = themeColors.text;
                    trendChart.update();

                    radarChart.options.plugins.tooltip.backgroundColor = themeColors.tooltipBg;
                    radarChart.options.plugins.tooltip.titleColor = themeColors.text;
                    radarChart.options.plugins.tooltip.bodyColor = themeColors.text;
                    radarChart.options.plugins.tooltip.borderColor = themeColors.tooltipBorder;
                    radarChart.options.scales.r.grid.color = themeColors.grid;
                    radarChart.options.scales.r.angleLines.color = themeColors.radarAngleLine;
                    radarChart.options.scales.r.pointLabels.color = themeColors.text;
                    radarChart.update();

                    doughnutChart.options.plugins.legend.labels.color = themeColors.text;
                    doughnutChart.options.plugins.tooltip.backgroundColor = themeColors.tooltipBg;
                    doughnutChart.options.plugins.tooltip.titleColor = themeColors.text;
                    doughnutChart.options.plugins.tooltip.bodyColor = themeColors.text;
                    doughnutChart.options.plugins.tooltip.borderColor = themeColors.tooltipBorder;
                    doughnutChart.update();
                }, 400); 
            });
        }

    } catch (err) {
        console.error("Analytics Initialization Error: ", err);
        gridNode.style.display = "none";
        warningNode.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--color-danger); margin-bottom: 20px; display: block;"></i>
            <h3 style="font-size: 1.5rem; margin-bottom: 10px; color: var(--color-danger);">Failed to load Analytics</h3>
            <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; line-height: 1.6;">${err.message}</p>
        `;
        warningNode.style.display = "block";
    }
});
