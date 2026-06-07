/* AI Health Assistant Chatbot Integration */
import { checkAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Multi-language translation maps
const chatbotTranslations = {
    en: {
        title: "AI Health Assistant",
        status: "Online",
        placeholder: "Ask me about your wellness...",
        disclaimer: "Disclaimer: This AI assistant provides educational wellness information only and is not a substitute for professional medical advice.",
        welcome_patient: "Hello, {name}! I'm your WellnessInsight AI. I can explain your health report, suggest diets, workouts, or answer wellness questions based on your latest vitals. What would you like to discuss?",
        welcome_doctor: "Hello, Dr. {name}! I can help you summarize audited patient cases, explain risk vectors, or compile clinical suggestions. Open a patient audit file to sync context.",
        key_missing: "To activate the AI assistant, please click the settings gear ⚙️ and configure your OpenAI API Key securely.",
        btn_save: "Save Key",
        btn_close: "Close",
        clear_confirm: "Are you sure you want to clear chat history?",
        err_api: "Failed to communicate with AI: ",
        active_patient_context: "Active Context: Auditing {name}",
        no_context: "Active Context: Directory Overview",
        pills: {
            explain_report: "Explain my health report",
            diet: "Healthy diet suggestions",
            exercise: "Exercise recommendations",
            bp: "Blood pressure guidance",
            diabetes: "Diabetes prevention tips",
            summarize: "Summarize audited patient",
            follow_up: "Generate follow-up plan",
            risks: "Explain risk vectors"
        }
    },
    hi: {
        title: "एआई स्वास्थ्य सहायक",
        status: "ऑनलाइन",
        placeholder: "अपने कल्याण के बारे में पूछें...",
        disclaimer: "अस्वीकरण: यह एआई सहायक केवल शैक्षिक कल्याण जानकारी प्रदान करता है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है।",
        welcome_patient: "नमस्ते, {name}! मैं आपका वेलनेसइनसाइट एआई हूँ। मैं आपकी रिपोर्ट समझा सकता हूँ, आहार/व्यायाम का सुझाव दे सकता हूँ, या आपके महत्वपूर्ण संकेतों के आधार पर कल्याण प्रश्नों के उत्तर दे सकता हूँ। आप क्या चर्चा करना चाहेंगे?",
        welcome_doctor: "नमस्ते, डॉ. {name}! मैं मरीज की फाइल का सारांश बनाने या सक्रिय मरीज के डेटा के आधार पर सिफारिशें तैयार करने में आपकी मदद कर सकता हूँ। संदर्भ सिंक करने के लिए मरीज की ऑडिट फाइल खोलें।",
        key_missing: "शुरू करने के लिए, कृपया सेटिंग्स गियर ⚙️ पर क्लिक करें और अपनी OpenAI API कुंजी सुरक्षित रूप से दर्ज करें।",
        btn_save: "कुंजी सहेजें",
        btn_close: "बंद करें",
        clear_confirm: "क्या आप वाकई चैट इतिहास को साफ करना चाहते हैं?",
        err_api: "एआई से संपर्क करने में असमर्थ: ",
        active_patient_context: "सक्रिय संदर्भ: मरीज {name} का ऑडिट",
        no_context: "सक्रिय संदर्भ: मरीज निर्देशिका",
        pills: {
            explain_report: "मेरी स्वास्थ्य रिपोर्ट समझाएं",
            diet: "स्वस्थ आहार के सुझाव",
            exercise: "व्यायाम की सिफारिशें",
            bp: "रक्तचाप मार्गदर्शन",
            diabetes: "मधुमेह से बचाव के उपाय",
            summarize: "सक्रिय मरीज का सारांश",
            follow_up: "अनुवर्ती योजना बनाएं",
            risks: "जोखिम कारकों को समझाएं"
        }
    },
    mr: {
        title: "एआई आरोग्य सहाय्यक",
        status: "ऑनलाइन",
        placeholder: "तुमच्या आरोग्याबद्दल विचारा...",
        disclaimer: "अस्वीकरण: हा एआय सहाय्यक केवळ शैक्षणिक कल्याण माहिती प्रदान करतो आणि व्यावसायिक वैद्यकीय सल्ल्याचा पर्याय नाही.",
        welcome_patient: "नमस्कार, {name}! मी तुमचा वेलनेसइनसाइट एआय आहे. मी तुमच्या आरोग्य अहवालाचे स्पष्टीकरण देऊ शकतो, आहार/व्यायामाचे सल्ले देऊ शकतो किंवा तुमच्या आरोग्याबद्दलच्या प्रश्नांची उत्तरे देऊ शकतो. तुम्हाला काय चर्चा करायला आवडेल?",
        welcome_doctor: "नमस्कार, डॉ. {name}! मी रुग्णाच्या फाईलचा सारांश काढण्यात किंवा सक्रिय रुग्णाच्या डेटाच्या आधारे शिफारसी तयार करण्यात मदत करू शकतो. संदर्भ सिंक करण्यासाठी रुग्णाचे ऑडिट फाईल उघडा.",
        key_missing: "सुरू करण्यासाठी, कृपया सेटिंग्स गियर ⚙️ वर क्लिक करा आणि तुमची OpenAI API की सुरक्षितपणे जतन करा.",
        btn_save: "की जतन करा",
        btn_close: "बंद करा",
        clear_confirm: "तुम्हाला नक्की चॅट इतिहास हटवायचा आहे का?",
        err_api: "एआय संपर्क अयशस्वी: ",
        active_patient_context: "सक्रिय संदर्भ: रुग्ण {name} चे ऑडिट",
        no_context: "सक्रिय संदर्भ: रुग्ण मार्गदर्शिका",
        pills: {
            explain_report: "माझा आरोग्य अहवाल स्पष्ट करा",
            diet: "निरोगी आहाराचे सल्ले",
            exercise: "व्यायामाच्या शिफारसी",
            bp: "रक्तदाब मार्गदर्शन",
            diabetes: "मधुमेह प्रतिबंधक टिप्स",
            summarize: "सक्रिय रुग्णाचा सारांश",
            follow_up: "फॉलो-अप योजना तयार करा",
            risks: "जोखिम घटकांचे स्पष्टीकरण"
        }
    }
};

// Global Chatbot Integration Class
class HealthChatbot {
    constructor() {
        this.user = null;
        this.profile = null;
        this.isOpen = false;
        this.chatHistory = [];
        this.patientVitals = null;
        this.activeLanguage = "en";
        this.isDoctor = false;
        this.isGenerating = false;
        this.currentAuditingPatient = null;

        // Secure keys management
        // Paste your OpenAI API Key here for an instant startup (e.g. "sk-proj-...")
        const defaultApiKey = "";
        let savedKey = localStorage.getItem("wellnessinsight_openai_key") || "";

        // Auto-sanitize in case the user accidentally pasted code code/quotes into the UI settings
        if (savedKey && (savedKey.includes("const ") || savedKey.includes("defaultApiKey") || savedKey.includes("=") || savedKey.includes('"') || savedKey.includes("'") || savedKey.includes(";"))) {
            localStorage.removeItem("wellnessinsight_openai_key");
            savedKey = "";
        }

        this.apiKey = savedKey || defaultApiKey;
        this.apiProxyUrl = null; // Update with production backend proxy if deployed (e.g. "/api/chat")

        this.init();
    }

    async init() {
        // Authenticate User Context
        checkAuth(async (user, profileData) => {
            if (!user) return;

            this.user = user;
            this.profile = profileData;
            this.isDoctor = profileData.role === "doctor";
            this.activeLanguage = window.i18n ? window.i18n.getLanguage() : "en";

            // Build Dynamic DOM
            this.injectWidgetDOM();

            // Load Context Records
            if (!this.isDoctor) {
                this.patientVitals = await this.fetchPatientVitals(user.uid);
            } else {
                this.startDoctorContextWatcher();
            }

            // Load Chat History
            this.loadHistoryFromStorage();

            // Bind Events
            this.bindEvents();

            // Sync initial state
            this.updateLanguageUI(this.activeLanguage);
        });
    }

    injectWidgetDOM() {
        // Prevent duplicate loads
        if (document.getElementById("healthChatbotWrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "healthChatbotWrapper";

        const markup = `
            <!-- Launcher Floating Button -->
            <button class="chatbot-launcher" id="chatbotLauncher" aria-label="Toggle Chatbot">
                <i class="fa-solid fa-comment-medical"></i>
            </button>
            
            <!-- Chat Window Panel -->
            <div class="chatbot-container" id="chatbotContainer">
                
                <!-- Chat Window Header -->
                <header class="chatbot-header">
                    <div class="chatbot-brand">
                        <div class="chatbot-avatar">
                            <i class="fa-solid fa-robot"></i>
                        </div>
                        <div class="chatbot-info">
                            <span class="chatbot-title" id="chatbotTitle">AI Health Assistant</span>
                            <span class="chatbot-status" id="chatbotStatus">
                                <span class="chatbot-status-dot"></span> Online
                            </span>
                        </div>
                    </div>
                    
                    <div class="chatbot-actions">
                        <button class="chatbot-btn" id="chatbotClearBtn" title="Clear History">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                        <button class="chatbot-btn" id="chatbotSettingsBtn" title="Settings">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button class="chatbot-btn" id="chatbotCloseBtn" title="Close Chat">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </header>

                <!-- Active Patient Context Banner for Doctors -->
                <div class="chatbot-context-banner" id="chatbotContextBanner" style="display: none;">
                    <i class="fa-solid fa-circle-info"></i>
                    <span id="chatbotContextText">Active Context: Directory</span>
                </div>
                
                <!-- Conversation Log Grid -->
                <div class="chatbot-messages" id="chatbotMessages">
                    <div class="chatbot-disclaimer" id="chatbotDisclaimer">
                        Disclaimer: This AI assistant provides educational wellness information only and is not a substitute for professional medical advice.
                    </div>
                    <div id="messagesContainer"></div>
                </div>

                <!-- Suggestions Panel -->
                <div class="chatbot-suggestions" id="chatbotSuggestions">
                    <!-- Dynamic Pills -->
                </div>

                <!-- User Message Input -->
                <div class="chatbot-input-area">
                    <textarea class="chatbot-input" id="chatbotInput" rows="1" placeholder="Ask me about your wellness..."></textarea>
                    <button class="chatbot-send-btn" id="chatbotSendBtn" aria-label="Send Message">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>

                <!-- API Key Configurations Drawer Overlay -->
                <div class="chatbot-settings-panel" id="chatbotSettingsPanel">
                    <header class="settings-header">
                        <span class="settings-title">AI Assistant Settings</span>
                        <button class="chatbot-btn" id="chatbotSettingsCloseBtn"><i class="fa-solid fa-xmark"></i></button>
                    </header>
                    <div class="settings-body">
                        <p class="settings-desc">
                            WellnessInsight integrates OpenAI API securely client-side. Your API key is cached locally in your web browser and is sent directly to OpenAI.
                        </p>
                        <div class="form-group">
                            <label for="openaiKeyInput">OpenAI API Key</label>
                            <div class="form-input-container">
                                <i class="fa-solid fa-key form-input-icon"></i>
                                <input type="password" id="openaiKeyInput" class="form-input" style="padding-left: 42px;" placeholder="sk-proj-...">
                            </div>
                        </div>
                        <button class="btn-primary" id="btnSaveSettings" style="width:100%; margin-top: 10px;">Save Configuration</button>
                    </div>
                </div>

            </div>
        `;
        wrapper.innerHTML = markup;
        document.body.appendChild(wrapper);
    }

    async fetchPatientVitals(uid) {
        try {
            const q = query(
                collection(db, "healthRecords"),
                where("patientId", "==", uid)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const records = [];
                snapshot.forEach(docSnap => records.push(docSnap.data()));
                // Sort in memory chronologically descending
                records.sort((a, b) => new Date(b.date) - new Date(a.date));
                return records[0];
            }
        } catch (err) {
            console.error("Chatbot failed to query latest health context:", err);
        }
        return null;
    }

    startDoctorContextWatcher() {
        // Watch DOM changes to identify active modal auditing context
        setInterval(() => {
            const auditModal = document.getElementById("auditModal");
            const isModalOpen = auditModal && (auditModal.style.display === "flex" || getComputedStyle(auditModal).display === "flex");

            if (isModalOpen) {
                const patName = document.getElementById("modalPatientName")?.textContent || "Patient";
                if (this.currentAuditingPatient !== patName) {
                    this.currentAuditingPatient = patName;
                    this.updateDoctorContextText(patName);
                }
            } else {
                if (this.currentAuditingPatient !== null) {
                    this.currentAuditingPatient = null;
                    this.updateDoctorContextText(null);
                }
            }
        }, 1500);
    }

    updateDoctorContextText(patientName) {
        const banner = document.getElementById("chatbotContextBanner");
        const bannerText = document.getElementById("chatbotContextText");
        const t = chatbotTranslations[this.activeLanguage];

        if (!banner || !bannerText) return;

        if (patientName) {
            bannerText.textContent = t.active_patient_context.replace("{name}", patientName);
            banner.style.display = "flex";
            banner.style.borderLeft = "3px solid var(--color-accent)";
            banner.style.color = "var(--color-accent)";
            banner.style.background = "var(--color-accent-glow)";
        } else {
            bannerText.textContent = t.no_context;
            banner.style.display = "flex";
            banner.style.borderLeft = "3px solid var(--color-primary)";
            banner.style.color = "var(--color-primary)";
            banner.style.background = "var(--color-primary-glow)";
        }

        // Refresh suggestions context
        this.renderSuggestions();
    }

    loadHistoryFromStorage() {
        const storageKey = `wellnessinsight_chat_history_${this.user.uid}`;
        const cached = localStorage.getItem(storageKey);

        if (cached) {
            this.chatHistory = JSON.parse(cached);
            this.renderHistory();
        } else {
            this.injectWelcomeGreeting();
        }
    }

    saveHistoryToStorage() {
        const storageKey = `wellnessinsight_chat_history_${this.user.uid}`;
        localStorage.setItem(storageKey, JSON.stringify(this.chatHistory));
    }

    renderHistory() {
        const container = document.getElementById("messagesContainer");
        if (!container) return;
        container.innerHTML = "";

        this.chatHistory.forEach(msg => {
            this.appendMessageBubble(msg.role, msg.content, msg.timestamp, false);
        });
        this.scrollChatToBottom();
    }

    injectWelcomeGreeting() {
        const container = document.getElementById("messagesContainer");
        if (!container) return;

        container.innerHTML = "";
        const t = chatbotTranslations[this.activeLanguage];
        let greeting = "";

        if (this.isDoctor) {
            const docName = this.profile.name || this.user.email.split("@")[0];
            greeting = t.welcome_doctor.replace("{name}", docName);
        } else {
            const patName = this.profile.name || this.user.email.split("@")[0];
            greeting = t.welcome_patient.replace("{name}", patName);
        }

        const msgObj = {
            role: "assistant",
            content: greeting,
            timestamp: new Date().toISOString()
        };

        this.chatHistory.push(msgObj);
        this.saveHistoryToStorage();
        this.appendMessageBubble("assistant", greeting, msgObj.timestamp, true);
    }

    appendMessageBubble(role, content, timestamp, animate = true) {
        const container = document.getElementById("messagesContainer");
        if (!container) return;

        const row = document.createElement("div");
        row.className = `chat-msg-row ${role === 'user' ? 'user' : 'ai'}`;

        const dateObj = new Date(timestamp);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        row.innerHTML = `
            <div class="chat-bubble ${role === 'user' ? 'user-bubble' : 'ai-bubble'}">
                <div class="chat-msg-content">${this.escapeHTML(content).replace(/\n/g, '<br>')}</div>
                <span class="chat-msg-time">${timeStr}</span>
            </div>
        `;

        if (animate) {
            row.style.opacity = 0;
            row.style.transform = "translateY(10px)";
            row.style.transition = "all 0.3s ease";
            container.appendChild(row);

            // Force redraw
            row.offsetHeight;
            row.style.opacity = 1;
            row.style.transform = "translateY(0)";
        } else {
            container.appendChild(row);
        }
    }

    bindEvents() {
        const launcher = document.getElementById("chatbotLauncher");
        const container = document.getElementById("chatbotContainer");
        const closeBtn = document.getElementById("chatbotCloseBtn");
        const clearBtn = document.getElementById("chatbotClearBtn");
        const settingsBtn = document.getElementById("chatbotSettingsBtn");
        const settingsCloseBtn = document.getElementById("chatbotSettingsCloseBtn");
        const input = document.getElementById("chatbotInput");
        const sendBtn = document.getElementById("chatbotSendBtn");
        const saveSettingsBtn = document.getElementById("btnSaveSettings");

        // Toggle Chat window
        launcher.addEventListener("click", () => {
            this.isOpen = !this.isOpen;
            launcher.classList.toggle("active", this.isOpen);
            container.classList.toggle("open", this.isOpen);

            if (this.isOpen) {
                this.scrollChatToBottom();
                input.focus();

                // If API Key is missing, alert the user inside chat
                if (!this.apiKey && this.chatHistory.length <= 1) {
                    const t = chatbotTranslations[this.activeLanguage];
                    this.appendMessageBubble("assistant", t.key_missing, new Date().toISOString(), true);
                }
            }
        });

        closeBtn.addEventListener("click", () => {
            this.isOpen = false;
            launcher.classList.remove("active");
            container.classList.remove("open");
        });

        // Settings Panel Toggle
        settingsBtn.addEventListener("click", () => {
            const panel = document.getElementById("chatbotSettingsPanel");
            const keyInput = document.getElementById("openaiKeyInput");
            if (keyInput) keyInput.value = this.apiKey;
            panel.classList.add("active");
        });

        settingsCloseBtn.addEventListener("click", () => {
            document.getElementById("chatbotSettingsPanel").classList.remove("active");
        });

        // Save Settings
        saveSettingsBtn.addEventListener("click", () => {
            const keyVal = document.getElementById("openaiKeyInput").value.trim();
            this.apiKey = keyVal;
            localStorage.setItem("wellnessinsight_openai_key", keyVal);
            alert("Settings saved successfully.");
            document.getElementById("chatbotSettingsPanel").classList.remove("active");

            // Reload greetings
            this.chatHistory = [];
            this.injectWelcomeGreeting();
        });

        // Clear Chat History
        clearBtn.addEventListener("click", () => {
            const t = chatbotTranslations[this.activeLanguage];
            if (confirm(t.clear_confirm)) {
                this.chatHistory = [];
                this.saveHistoryToStorage();
                this.injectWelcomeGreeting();
            }
        });

        // Key bindings
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        sendBtn.addEventListener("click", () => {
            this.handleSendMessage();
        });

        // Listen to localization updates
        window.addEventListener("languagechanged", (e) => {
            this.activeLanguage = e.detail.language;
            this.updateLanguageUI(this.activeLanguage);
        });
    }

    updateLanguageUI(lang) {
        this.activeLanguage = lang;
        const t = chatbotTranslations[lang];

        // Labels
        document.getElementById("chatbotTitle").textContent = t.title;
        document.getElementById("chatbotStatus").innerHTML = `<span class="chatbot-status-dot"></span> ${t.status}`;
        document.getElementById("chatbotDisclaimer").textContent = t.disclaimer;
        document.getElementById("chatbotInput").placeholder = t.placeholder;

        document.getElementById("chatbotClearBtn").title = lang === "mr" ? "इतिहास हटवा" : lang === "hi" ? "इतिहास साफ करें" : "Clear History";
        document.getElementById("chatbotSettingsBtn").title = lang === "mr" ? "सेटिंग्ज" : lang === "hi" ? "सेटिंग्स" : "Settings";
        document.getElementById("chatbotCloseBtn").title = lang === "mr" ? "चॅट बंद करा" : lang === "hi" ? "चैट बंद करें" : "Close Chat";

        const settingsTitleNode = document.querySelector(".settings-title");
        if (settingsTitleNode) {
            settingsTitleNode.textContent = lang === "mr" ? "एआय सहाय्यक सेटिंग्स" : lang === "hi" ? "एआई सहायक सेटिंग्स" : "AI Assistant Settings";
        }

        const saveSettingsNode = document.getElementById("btnSaveSettings");
        if (saveSettingsNode) {
            saveSettingsNode.textContent = t.btn_save;
        }

        const closeSettingsNode = document.getElementById("chatbotSettingsCloseBtn");
        if (closeSettingsNode) {
            closeSettingsNode.title = t.btn_close;
        }

        // Context check for Doctor
        if (this.isDoctor) {
            this.updateDoctorContextText(this.currentAuditingPatient);
        }

        // Refresh pills & layout
        this.renderSuggestions();
    }

    renderSuggestions() {
        const box = document.getElementById("chatbotSuggestions");
        if (!box) return;
        box.innerHTML = "";

        const t = chatbotTranslations[this.activeLanguage];
        const pills = [];

        if (this.isDoctor) {
            // Auditing suggestions
            if (this.currentAuditingPatient) {
                pills.push({ text: t.pills.summarize, val: "Summarize the active audited patient records." });
                pills.push({ text: t.pills.follow_up, val: "Generate professional follow-up guidelines for this audited patient based on vitals." });
                pills.push({ text: t.pills.risks, val: "Audit and explain risk indicators for the selected patient." });
            } else {
                pills.push({ text: "Patient summaries advice", val: "How do I compose clinical care notes for high-risk cardiac vectors?" });
            }
        } else {
            // Patient suggestions
            pills.push({ text: t.pills.explain_report, val: "Please explain my health report assessment numbers." });
            pills.push({ text: t.pills.diet, val: "Give me customized healthy diet suggestions based on my vitals." });
            pills.push({ text: t.pills.exercise, val: "Recommend exercise goals suited for my profile." });
            pills.push({ text: t.pills.bp, val: "Explain my blood pressure readings and provide standard lifestyle guidance." });
            pills.push({ text: t.pills.diabetes, val: "What are some practical diabetes prevention guidelines?" });
        }

        pills.forEach(p => {
            const btn = document.createElement("button");
            btn.className = "suggestion-pill";
            btn.textContent = p.text;
            btn.addEventListener("click", () => {
                this.handleSendMessage(p.val);
            });
            box.appendChild(btn);
        });
    }

    async handleSendMessage(customText = null) {
        if (this.isGenerating) return;

        const input = document.getElementById("chatbotInput");
        const queryText = (customText || input.value).trim();

        if (!queryText) return;

        // Reset input field
        if (!customText) {
            input.value = "";
            input.style.height = "auto";
        }

        const userMsgTimestamp = new Date().toISOString();

        // 1. Append User Message
        this.chatHistory.push({
            role: "user",
            content: queryText,
            timestamp: userMsgTimestamp
        });
        this.saveHistoryToStorage();
        this.appendMessageBubble("user", queryText, userMsgTimestamp, true);
        this.scrollChatToBottom();

        // 2. Local Fallback Responses Interceptor (Bypasses API key constraint for suggestions)
        if (!this.apiKey && !this.apiProxyUrl) {
            const fallbackResponse = this.generateLocalFallback(queryText);
            if (fallbackResponse) {
                this.setGeneratingState(true);
                this.showTypingIndicator();
                setTimeout(() => {
                    this.hideTypingIndicator();
                    const aiMsgTimestamp = new Date().toISOString();
                    
                    let replyContent = fallbackResponse;
                    const disclaimerText = chatbotTranslations[this.activeLanguage].disclaimer;
                    if (!replyContent.includes("Disclaimer") && !replyContent.includes("अस्वीकरण") && !this.isDoctor) {
                        replyContent += `\n\n_${disclaimerText}_`;
                    }
                    
                    this.chatHistory.push({
                        role: "assistant",
                        content: replyContent,
                        timestamp: aiMsgTimestamp
                    });
                    this.saveHistoryToStorage();
                    this.appendMessageBubble("assistant", replyContent, aiMsgTimestamp, true);
                    this.setGeneratingState(false);
                    this.scrollChatToBottom();
                }, 800);
                return;
            }
            
            // Standard missing key prompt warning
            const t = chatbotTranslations[this.activeLanguage];
            const ts = new Date().toISOString();
            this.chatHistory.push({
                role: "assistant",
                content: t.key_missing,
                timestamp: ts
            });
            this.saveHistoryToStorage();
            this.appendMessageBubble("assistant", t.key_missing, ts, true);
            this.scrollChatToBottom();
            return;
        }

        // 3. Trigger Generating State
        this.setGeneratingState(true);
        this.showTypingIndicator();

        try {
            // Build Prompt Payload
            const messagesPayload = this.compilePayload(queryText);

            // Fetch Completions
            let replyContent = "";
            if (this.apiProxyUrl) {
                replyContent = await this.queryProxyServer(messagesPayload);
            } else {
                replyContent = await this.queryOpenAI(messagesPayload);
            }

            // Append Disclaimer to OpenAI output if missing
            const disclaimerText = chatbotTranslations[this.activeLanguage].disclaimer;
            if (!replyContent.includes("Disclaimer") && !replyContent.includes("अस्वीकरण") && !this.isDoctor) {
                replyContent += `\n\n_${disclaimerText}_`;
            }

            // Save & Render AI reply
            const aiMsgTimestamp = new Date().toISOString();
            this.chatHistory.push({
                role: "assistant",
                content: replyContent,
                timestamp: aiMsgTimestamp
            });
            this.saveHistoryToStorage();
            this.hideTypingIndicator();
            this.appendMessageBubble("assistant", replyContent, aiMsgTimestamp, true);

        } catch (err) {
            console.error("OpenAI completions error:", err);
            this.hideTypingIndicator();
            const errTimestamp = new Date().toISOString();
            const errLabel = chatbotTranslations[this.activeLanguage].err_api + err.message;
            this.appendMessageBubble("assistant", errLabel, errTimestamp, true);
        } finally {
            this.setGeneratingState(false);
            this.scrollChatToBottom();
        }
    }

    generateLocalFallback(queryText) {
        const text = queryText.toLowerCase();
        const lang = this.activeLanguage;
        
        // 1. Patient Portal Fallback logic
        if (!this.isDoctor) {
            const v = this.patientVitals;
            
            const dict = {
                en: {
                    no_scan: "You haven't run any health assessment scans yet. Please complete a scan in the Health Wizard first so I can analyze your vitals!",
                    bp_stage2: "Stage 2 Hypertension",
                    bp_stage1: "Stage 1 Hypertension",
                    bp_elevated: "Elevated BP",
                    bp_normal: "Normal BP",
                    gluc_diabetic: "Diabetic range",
                    gluc_pre: "Pre-Diabetic range",
                    gluc_normal: "Normal range",
                    normal: "Normal",
                    underweight: "Underweight",
                    overweight: "Overweight",
                    obese: "Obese"
                },
                hi: {
                    no_scan: "आपने अभी तक कोई स्वास्थ्य मूल्यांकन स्कैन नहीं किया है। कृपया पहले हेल्थ विजार्ड में एक स्कैन पूरा करें ताकि मैं आपके महत्वपूर्ण अंगों का विश्लेषण कर सकूँ!",
                    bp_stage2: "स्टेज 2 उच्च रक्तचाप",
                    bp_stage1: "स्टेज 1 उच्च रक्तचाप",
                    bp_elevated: "बढ़ा हुआ रक्तचाप",
                    bp_normal: "सामान्य रक्तचाप",
                    gluc_diabetic: "मधुमेह सीमा",
                    gluc_pre: "प्री-डायबिटिक सीमा",
                    gluc_normal: "सामान्य सीमा",
                    normal: "सामान्य",
                    underweight: "कम वजन",
                    overweight: "अधिक वजन",
                    obese: "मोटापा"
                },
                mr: {
                    no_scan: "तुम्ही अद्याप कोणतेही आरोग्य मूल्यमापन स्कॅन केलेले नाही. कृपया आधी हेल्थ विझार्डमध्ये स्कॅन पूर्ण करा जेणेकरून मी तुमच्या आरोग्याचे विश्लेषण करू शकेन!",
                    bp_stage2: "स्टेज 2 उच्च रक्तदाब",
                    bp_stage1: "स्टेज 1 उच्च रक्तदाब",
                    bp_elevated: "वाढलेला रक्तदाब",
                    bp_normal: "सामान्य रक्तदाब",
                    gluc_diabetic: "मधुमेह पातळी",
                    gluc_pre: "प्री-डायबिटिक पातळी",
                    gluc_normal: "सामान्य पातळी",
                    normal: "सामान्य",
                    underweight: "कमी वजन",
                    overweight: "जादा वजन",
                    obese: "लठ्ठपणा"
                }
            }[lang];
            
            const matchesReport = text.includes("report") || text.includes("assessment") || text.includes("संख्या") || text.includes("स्पष्ट करा") || text.includes("समझाएं") || text.includes("रिपोर्ट");
            const matchesDiet = text.includes("diet") || text.includes("nutrition") || text.includes("आहार") || text.includes("जेवण") || text.includes("भोजन");
            const matchesExercise = text.includes("exercise") || text.includes("workout") || text.includes("person-running") || text.includes("व्यायाम") || text.includes("वर्कआउट") || text.includes("physical activity");
            const matchesBp = text.includes("bp") || text.includes("blood pressure") || text.includes("रक्तचाप") || text.includes("रक्तदाब") || text.includes("दाब");
            const matchesDiabetes = text.includes("diabetes") || text.includes("sugar") || text.includes("glucose") || text.includes("मधुमेह") || text.includes("साखर") || text.includes("prevention tips");

            if (!v && (matchesReport || matchesDiet || matchesExercise || matchesBp || matchesDiabetes)) {
                return dict.no_scan;
            }

            if (matchesReport) {
                let bpStatus = dict.bp_normal;
                if (v.systolic >= 140 || v.diastolic >= 90) bpStatus = dict.bp_stage2;
                else if (v.systolic >= 130 || v.diastolic >= 80) bpStatus = dict.bp_stage1;
                else if (v.systolic >= 120 && v.diastolic < 80) bpStatus = dict.bp_elevated;

                let glucStatus = dict.gluc_normal;
                if (v.glucose >= 126) glucStatus = dict.gluc_diabetic;
                else if (v.glucose >= 100) glucStatus = dict.gluc_pre;

                const bmiCat = dict[v.bmiCategory.toLowerCase()] || v.bmiCategory;

                if (lang === "hi") {
                    return `आपके नवीनतम स्कैन के आधार पर स्वास्थ्य रिपोर्ट (**स्वास्थ्य सूचकांक: ${v.healthScore}/100**):
• **रक्तचाप**: ${v.systolic}/${v.diastolic} mmHg - यह **${bpStatus}** श्रेणी में है।
• **फास्टिंग ग्लूकोज**: ${v.glucose} mg/dL - यह **${glucStatus}** है।
• **बीएमआई (BMI)**: ${v.bmi} (${bmiCat}) - यह दर्शाता है कि आपका वजन वर्ग **${bmiCat}** है।
• **जोखिम विश्लेषण**: हृदय रोग जोखिम **${v.risks?.heart || 0}%**, मधुमेह जोखिम **${v.risks?.diabetes || 0}%**, स्ट्रोक जोखिम **${v.risks?.stroke || 0}%** है।
• **डॉक्टर की सलाह**: "${this.profile.doctorNote || 'अभी तक कोई डॉक्टर नोट्स नहीं हैं।'}"`;
                } else if (lang === "mr") {
                    return `तुमच्या नवीनतम स्कॅनच्या आधारे आरोग्य अहवाल (**आरोग्य निर्देशांक: ${v.healthScore}/100**):
• **रक्तदाब**: ${v.systolic}/${v.diastolic} mmHg - हे **${bpStatus}** श्रेणीमध्ये आहे.
• **फास्टिंग ग्लुकोज**: ${v.glucose} mg/dL - हे **${glucStatus}** आहे.
• **बीएमआई (BMI)**: ${v.bmi} (${bmiCat}) - हे तुमचे वजन वर्गीकरण **${bmiCat}** दर्शवते.
• **जोखिम विश्लेषण**: हृदयविकाराचा धोका **${v.risks?.heart || 0}%**, मधुमेह धोका **${v.risks?.diabetes || 0}%**, स्ट्रोक धोका **${v.risks?.stroke || 0}%** आहे.
• **डॉक्टरांचा सल्ला**: "${this.profile.doctorNote || 'अद्याप डॉक्टरांचा सल्ला उपलब्ध नाही.'}"`;
                } else {
                    return `Based on your latest scan, here is your health report (**Health Index: ${v.healthScore}/100**):
• **Blood Pressure**: ${v.systolic}/${v.diastolic} mmHg is classified as **${bpStatus}**.
• **Fasting Glucose**: ${v.glucose} mg/dL is in the **${glucStatus}**.
• **BMI**: ${v.bmi} (${bmiCat}) indicates you are **${bmiCat}**.
• **Calculated AI Risks**: Heart Disease risk is **${v.risks?.heart || 0}%**, Diabetes risk is **${v.risks?.diabetes || 0}%**, and Stroke risk is **${v.risks?.stroke || 0}%**.
• **Doctor Note**: "${this.profile.doctorNote || 'No published doctor notes.'}"`;
                }
            }

            if (matchesDiet) {
                const highBP = v.systolic >= 120 || v.diastolic >= 80;
                const highGlucose = v.glucose >= 100;
                const highBMI = v.bmi >= 25;

                if (lang === "hi") {
                    let advice = "आपके स्वास्थ्य मापदंडों के आधार पर आहार संबंधी सिफारिशें:\n";
                    if (highBP) advice += "• **कम सोडियम**: दैनिक नमक का सेवन 1.5 - 2 ग्राम (आधा चम्मच) तक सीमित करें। प्रसंस्कृत खाद्य पदार्थों से बचें।\n";
                    if (highGlucose) advice += "• **कम कार्बोहाइड्रेट**: परिष्कृत चीनी, मैदा, मीठे पेय और आलू का सेवन कम करें। फाइबर युक्त खाद्य पदार्थ (साबुत अनाज) खाएं।\n";
                    if (highBMI) advice += "• **वजन नियंत्रण**: कैलोरी घाटे का पालन करें और संतुलित आहार में अधिक प्रोटीन और हरी सब्जियाँ शामिल करें।\n";
                    if (!highBP && !highGlucose && !highBMI) advice += "• **संतुलित आहार**: हरी सब्जियाँ, दालें, फल और पर्याप्त पानी पीते रहें। आपका आहार उत्कृष्ट है!\n";
                    advice += "• **हाइड्रेशन**: प्रतिदिन कम से कम 8-10 गिलास पानी अवश्य पिएं।";
                    return advice;
                } else if (lang === "mr") {
                    let advice = "तुमच्या आरोग्याच्या स्थितीनुसार आहाराचे सल्ले:\n";
                    if (highBP) advice += "• **कमी सोडियम**: मिठाचे प्रमाण कमी करा. प्रक्रिया केलेल्या खाद्यपदार्थांऐवजी नैसर्गिक पदार्थांना प्राधान्य द्या.\n";
                    if (highGlucose) advice += "• **कमी कर्बोदके**: गोड पदार्थ, मैदा, बटाटा आणि साखर कमी करा. फायबरयुक्त पदार्थ (उदा. ज्वारी, बाजरी) खा.\n";
                    if (highBMI) advice += "• **वजन व्यवस्थापन**: संतुलित प्रमाणात प्रथिने (प्रोटीन) आणि हिरव्या पालेभाज्यांचा समावेश करा.\n";
                    if (!highBP && !highGlucose && !highBMI) advice += "• **संतुलित आहार**: हिरव्या भाज्या, डाळी, फळे आणि पाणी यांचे योग्य प्रमाण ठेवा. तुमचे जेवण उत्तम आहे!\n";
                    advice += "• **हायड्रेशन**: दिवसातून ८ ते १० ग्लास पाणी नक्की प्या.";
                    return advice;
                } else {
                    let advice = "Here are customized dietary recommendations based on your vitals:\n";
                    if (highBP) advice += "• **Low Sodium**: Restrict daily sodium to <2000mg. Substitute salt with fresh herbs. Avoid canned/processed meals.\n";
                    if (highGlucose) advice += "• **Low Glycemic**: Limit white sugar, refined wheat, soda, and high-starch foods. Emphasize complex carbs and whole grains.\n";
                    if (highBMI) advice += "• **Portion Control**: Track daily caloric intake, increase lean proteins, and double your green vegetable portions.\n";
                    if (!highBP && !highGlucose && !highBMI) advice += "• **Balanced Diet**: Keep up the great work! Focus on clean eating, healthy fats (nuts, olive oil), and lean proteins.\n";
                    advice += "• **Hydration**: Ensure a baseline of 2.5 - 3 liters of water daily.";
                    return advice;
                }
            }

            if (matchesExercise) {
                const isSedentary = v.activity === "sedentary";
                const highBMI = v.bmi >= 25;

                if (lang === "hi") {
                    let advice = "आपके लिए शारीरिक गतिविधि की सिफारिशें:\n";
                    if (isSedentary) advice += "• **शुरुआत करें**: सप्ताह में 5 दिन कम से कम 30 मिनट तेज गति से चलें (ब्रिस्क वॉकिंग)।\n";
                    else advice += "• **तीव्रता बढ़ाएं**: सप्ताह में 3 बार 20-30 मिनट जोगिंग या कार्डियो वर्कआउट करें।\n";
                    if (highBMI) advice += "• **स्ट्रेंथ ट्रेनिंग**: कैलोरी बर्न करने और मांसपेशियों को मजबूत करने के लिए सप्ताह में 2 बार वजन उठाने वाले व्यायाम शामिल करें।\n";
                    advice += "• **स्टेप गोल**: प्रतिदिन 8,000 कदम चलने का लक्ष्य रखें।";
                    return advice;
                } else if (lang === "mr") {
                    let advice = "तुमच्यासाठी व्यायामाच्या शिफारसी:\n";
                    if (isSedentary) advice += "• **सुरुवात करा**: आठवड्यातून ५ दिवस रोज किमान ३० मिनिटे वेगाने चाला.\n";
                    else advice += "• **प्रमाण वाढवा**: आठवड्यातून ३ वेळा २५-३० मिनिटे धावणे किंवा हलका व्यायाम करा.\n";
                    if (highBMI) advice += "• **स्ट्रेंथ ट्रेनिंग**: आठवड्यातून २ वेळा हलका ताकदीचा व्यायाम करा, जेणेकरून अतिरिक्त चरबी कमी होईल.\n";
                    advice += "• **स्टेप गोल**: दररोज ८,००० ते १०,००० पावले चालण्याचे ध्येय ठेवा.";
                    return advice;
                } else {
                    let advice = "Customized physical activity recommendations for your profile:\n";
                    if (isSedentary) advice += "• **Beginner cardio**: Start with 30 minutes of brisk walking 5 days a week. Gradually increase pace.\n";
                    else advice += "• **Intermediate training**: Introduce jogging, cycling, or light swimming for 45 minutes 3-4 days a week.\n";
                    if (highBMI) advice += "• **Resistance training**: Add bodyweight squats, lunges, and light resistance bands twice a week to build lean muscle mass.\n";
                    advice += "• **Daily Target**: Aim for a minimum baseline of 8,000 steps daily.";
                    return advice;
                }
            }

            if (matchesBp) {
                if (lang === "hi") {
                    return `**रक्तचाप (Blood Pressure) मार्गदर्शन:**
• आपका हालिया रक्तचाप **${v.systolic}/${v.diastolic} mmHg** है।
• **स्वस्थ सीमा**: आदर्श रक्तचाप 120/80 mmHg से कम होता है।
• **बचाव के उपाय**:
  1. भोजन में नमक कम करें (प्रतिदिन आधा चम्मच से कम)।
  2. प्रतिदिन 30 मिनट तेज चलना या साइकिल चलाना शामिल करें।
  3. तनाव प्रबंधन करें (ध्यान, योग या गहरी सांस लेना)।
  4. यदि रक्तचाप लगातार 140/90 से ऊपर रहता है, तो अपने डॉक्टर से मिलें।`;
                } else if (lang === "mr") {
                    return `**रक्तदाब (Blood Pressure) मार्गदर्शन:**
• तुमचा अलीकडील रक्तदाब **${v.systolic}/${v.diastolic} mmHg** आहे.
• **योग्य प्रमाण**: निरोगी रक्तदाब १२०/८० mmHg पेक्षा कमी असतो.
• **बचाव उपाय**:
  1. आहारात मिठाचा वापर कमी करा (दिवसाला अर्ध्या चमच्यापेक्षा कमी).
  2. दररोज किमान ३० मिनिटे वेगाने चालणे किंवा व्यायाम करणे.
  3. ध्यान किंवा योगासने करून ताणतणाव कमी करा.
  4. रक्तदाब वारंवार १४०/९० पेक्षा जास्त आल्यास डॉक्टरांचा सल्ला घ्या.`;
                } else {
                    return `**Blood Pressure Guidance:**
• Your latest BP reading is **${v.systolic}/${v.diastolic} mmHg**.
• **Optimal Target**: Under 120/80 mmHg is considered normal.
• **Actionable Tips**:
  1. **Restrict sodium**: Avoid added salt, processed cheese, and chips.
  2. **Active lifestyle**: Engaged in at least 150 minutes of cardio exercise weekly.
  3. **Stress relief**: Practice box-breathing or meditation daily.
  4. **Medical follow-up**: Consult a doctor if readings persistently exceed 130/80 mmHg.`;
                }
            }

            if (matchesDiabetes) {
                if (lang === "hi") {
                    return `**मधुमेह (Diabetes) और ग्लूकोज मार्गदर्शन:**
• आपका हालिया फास्टिंग ग्लूकोज **${v.glucose} mg/dL** है।
• **स्वस्थ सीमा**: सामान्य फास्टिंग ग्लूकोज 70-99 mg/dL के बीच होता है।
• **बचाव के उपाय**:
  1. सफेद चावल, चीनी, मैदा और मीठे पेय पदार्थों से बिल्कुल दूर रहें।
  2. फाइबर युक्त खाद्य पदार्थ जैसे ओट्स, अंकुरित अनाज और दालें खाएं।
  3. भोजन के बाद 10 मिनट की वॉक करें, यह रक्त शर्करा को नियंत्रित करता है।
  4. वजन नियंत्रित रखें।`;
                } else if (lang === "mr") {
                    return `**मधुमेह (Diabetes) आणि ग्लुकोज मार्गदर्शन:**
• तुमचे अलीकडील फास्टिंग ग्लुकोज **${v.glucose} mg/dL** आहे।
• **योग्य प्रमाण**: निरोगी उपाशी पोटी (Fasting) ग्लुकोज ७० ते ९९ mg/dL दरम्यान असावे.
• **बचाव उपाय**:
  1. साखर, गोड पदार्थ, मैदा, चहा आणि पांढरा भात यांचे प्रमाण अत्यंत कमी करा.
  2. आहारात डाळी, कडधान्ये आणि ओट्स यांसारख्या फायबरयुक्त पदार्थांचा समावेश करा.
  3. रात्रीच्या जेवणानंतर किमान १० ते १५ मिनिटे चाला.
  4. वजन नियंत्रणात ठेवा.`;
                } else {
                    return `**Diabetes Prevention & Glucose Guidance:**
• Your fasting blood sugar is **${v.glucose} mg/dL**.
• **Optimal Target**: Fasting glucose between 70 and 99 mg/dL is normal.
• **Actionable Tips**:
  1. **Diet**: Restrict sugars, sweet juices, refined flour, and white rice.
  2. **Fiber**: Eat oats, beans, brown rice, and vegetables to slow sugar absorption.
  3. **Exercise**: A short 10-15 minute walk after meals helps lower postprandial glucose spikes.
  4. **Monitor**: Schedule an HbA1c test (3-month average glucose) once a year.`;
                }
            }
        } else {
            // 2. Doctor Portal Auditing Fallback
            const audited = this.getActiveDoctorAuditedPatient();
            
            const matchesSummarize = text.includes("summarize") || text.includes("summary") || text.includes("सारांश");
            const matchesFollowUp = text.includes("follow-up") || text.includes("follow up") || text.includes("अनुवर्ती") || text.includes("योजना");
            const matchesRisks = text.includes("risk") || text.includes("जोखिम") || text.includes("धोका") || text.includes("risk vectors");

            if (audited) {
                if (matchesSummarize) {
                    return `**Clinical Case Summary for ${audited.name}** (${audited.age} Yrs, ${audited.gender}):
• **Biometrics Overview**: BMI: ${audited.bmi} | BP: ${audited.bp} | Glucose: ${audited.glucose} mg/dL | Pulse: ${audited.pulse}
• **AI Risk Indices**: Heart Disease: ${audited.risks.heart} | Diabetes: ${audited.risks.diabetes} | Stroke: ${audited.risks.stroke}
• **Symptoms Logged**: ${audited.symptoms}
• **Active Specialist Care Notes**: "${audited.doctorNote || 'No notes currently written.'}"`;
                }

                if (matchesFollowUp) {
                    return `**Suggested Follow-up Care Plan for ${audited.name}**:
1. **Outpatient Consultation**: Schedule a telehealth follow-up session within 14 days to review vitals history.
2. **Clinical Panel**: Request a comprehensive Metabolic Profile (CMP) and Lipid Panel if BP/Glucose exceeds threshold.
3. **Lifestyle Directives**:
   - Instruct patient to log daily hydration (8+ glasses target).
   - Prescribe 150 mins of moderate aerobic training weekly.
   - Advise low-sodium guidelines (<2,000mg salt target).`;
                }

                if (matchesRisks) {
                    return `**Disease Risk Factor Correlation for ${audited.name}**:
• **Cardiovascular Vector**: Heart Disease risk is **${audited.risks.heart}** (linked to BP: ${audited.bp}). Recommend tracking daily vitals logs.
• **Endocrine Vector**: Diabetes risk is **${audited.risks.diabetes}** (linked to Glucose: ${audited.glucose}). Focus on carbohydrate restrictions.
• **Neurological Vector**: Stroke risk is **${audited.risks.stroke}** (directly correlated with systolic BP). Ensure BP is stabilized.`;
                }
            }
        }
        
        if (text.length > 2) {
            const t = chatbotTranslations[lang];
            if (lang === "hi") {
                return `आप वर्तमान में **स्थानीय कल्याण सलाहकार मोड** (बिना कुंजी/पासवर्ड के) में हैं। 

कृत्रिम बुद्धिमत्ता (AI) से सीधे कस्टम बातचीत करने के लिए, कृपया सेटिंग्स गियर ⚙️ पर क्लिक करके अपनी **OpenAI API कुंजी** दर्ज करें।

कल्याण की सामान्य सलाह: स्वस्थ जीवन शैली के लिए संतुलित आहार लें, रोजाना व्यायाम करें, खूब पानी पिएं और अपने डॉक्टर से संपर्क बनाए रखें।`;
            } else if (lang === "mr") {
                return `तुम्ही सध्या **स्थानिक कल्याण सल्लागार मोड** (की/पासवर्ड शिवाय) मध्ये आहात.

कृत्रिम बुद्धिमत्ता (AI) शी थेट सानुकूल चॅटिंग करण्यासाठी, कृपया वर सेटिंग्स गियर ⚙️ वर क्लिक करून तुमची **OpenAI API की** दर्ज करा.

आरोग्यासाठी सामान्य सल्ला: रोज पुरेसा व्यायाम करा, पाणी प्या, मिठाचे प्रमाण कमी ठेवा आणि काही त्रास जाणवल्यास त्वरित डॉक्टरांशी संपर्क साधा.`;
            } else {
                return `You are currently using the **Local Wellness Advisor Mode** (Running without an API key).

To ask custom questions and chat dynamically with the cloud AI, please click the settings gear (⚙️) to enter your **OpenAI API Key**.

**General Wellness Advice:**
Ensure a balanced diet rich in leafy greens, maintain 150 minutes of weekly cardiovascular exercise, track daily hydration, and always consult a doctor for clinical guidance.`;
            }
        }

        return null;
    }

    compilePayload(latestQuery) {
        // Compile Contextual System Prompt
        const activeLangName = this.activeLanguage === "mr" ? "Marathi" : this.activeLanguage === "hi" ? "Hindi" : "English";
        let systemPrompt = "";

        if (this.isDoctor) {
            // Doctor Panel Prompt
            const audited = this.getActiveDoctorAuditedPatient();
            systemPrompt = `You are a clinical assistant for WellnessInsight Health Predictor dashboard. Your role is to help medical specialists analyze patient directories, summarize patient vitals, and outline checkups. 
You are communicating with Dr. ${this.profile.name || "Specialist"}.`;

            if (audited) {
                systemPrompt += `\nHere is the active patient context:
- Name: ${audited.name}
- Age/Gender: ${audited.age} / ${audited.gender}
- Blood Group: ${audited.bloodGroup}
- Vitals: BMI: ${audited.bmi}, BP: ${audited.bp}, Fasting Glucose: ${audited.glucose}, Pulse: ${audited.pulse}
- Computed Disease Risks: Heart Disease: ${audited.risks.heart}, Diabetes: ${audited.risks.diabetes}, Stroke: ${audited.risks.stroke}
- Patient Symptoms: ${audited.symptoms}
- Active Feedback Care notes entered by doctor: "${audited.doctorNote}"`;
            } else {
                systemPrompt += `\nNo specific patient file is audited currently. You can answer general clinical standards questions, provide templates for treatments, or explain diagnostic metrics (e.g. Stage 1/2 Hypertension or Pre-Diabetic indicators).`;
            }
            systemPrompt += `\nProvide professional, scientific, clinical summaries. Respond in the language ${activeLangName}.`;

        } else {
            // Patient Dashboard Prompt
            const vitals = this.patientVitals;
            const disclaimerText = chatbotTranslations[this.activeLanguage].disclaimer;

            systemPrompt = `You are "WellnessInsight AI Health Assistant", a friendly and professional digital wellness companion for patients. 
Your goal is to provide educational wellness and metabolic tracking advices.
${disclaimerText}
- Never provide direct medical diagnoses or tell a patient they have a specific disease.
- Always frame risk ratios as educational indicators computed by our AI algorithms.
- Advocate for professional doctor consultation.
- Recommend physical exercises, dietary adjustments (low sodium/sugar limit), hydration, and clinic checks.
- Keep replies concise, using short paragraphs.`;

            if (vitals) {
                systemPrompt += `\nHere is the patient's latest metabolic profile details:
- Name: ${this.profile.name || "Member"}
- Basic: Age ${vitals.age} | Assigned Gender: ${vitals.gender} | Blood Group: ${vitals.bloodGroup || 'Not provided'}
- BMI Ratio: ${vitals.bmi} (${vitals.bmiCategory})
- Blood Pressure: ${vitals.systolic}/${vitals.diastolic} mmHg (BP classification: ${vitals.systolic >= 140 ? 'Stage 2 Hypertension' : vitals.systolic >= 130 ? 'Stage 1 Hypertension' : vitals.systolic >= 120 ? 'Elevated' : 'Normal'})
- Fasting Glucose: ${vitals.glucose} mg/dL
- Resting Heart Rate: ${vitals.heartRate} bpm
- Calculated AI Disease Risk Ratios: Heart Disease: ${vitals.risks?.heart || 0}%, Diabetes: ${vitals.risks?.diabetes || 0}%, Stroke: ${vitals.risks?.stroke || 0}%
- Active symptoms reported: ${(vitals.symptoms && vitals.symptoms.length > 0) ? vitals.symptoms.join(", ") : 'None'}
- Doctor Care note instructions: "${this.profile.doctorNote || 'No doctor notes published yet.'}"`;
            } else {
                systemPrompt += `\nNo diagnostic scan records are recorded on dashboard yet. Remind them to run the "Health Wizard" assessment scan first.`;
            }
            systemPrompt += `\nRespond in the language ${activeLangName}. Ensure all responses are in ${activeLangName}.`;
        }

        // Construct Chat History messages
        const historyLengthLimit = 10; // Keep context history bound
        const conversationSlice = this.chatHistory.slice(-historyLengthLimit);

        const messages = [{ role: "system", content: systemPrompt }];
        conversationSlice.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });

        return messages;
    }

    async queryOpenAI(messages) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.5,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${response.status} Error`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async queryProxyServer(messages) {
        const response = await fetch(this.apiProxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                userLanguage: this.activeLanguage
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Proxy Server Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || data.reply || "";
    }

    getActiveDoctorAuditedPatient() {
        const auditModal = document.getElementById("auditModal");
        const isModalOpen = auditModal && (auditModal.style.display === "flex" || getComputedStyle(auditModal).display === "flex");

        if (isModalOpen) {
            const name = document.getElementById("modalPatientName")?.textContent || "Patient";
            const age = document.getElementById("modalAge")?.textContent || "--";
            const gender = document.getElementById("modalGender")?.textContent || "--";
            const bloodGroup = document.getElementById("modalBloodGroup")?.textContent || "--";
            const bmi = document.getElementById("modalBmi")?.textContent || "--";
            const bp = document.getElementById("modalBp")?.textContent || "--";
            const glucose = document.getElementById("modalGlucose")?.textContent || "--";
            const pulse = document.getElementById("modalPulse")?.textContent || "--";

            const riskHeart = document.getElementById("modalRiskHeart")?.textContent || "0%";
            const riskDiabetes = document.getElementById("modalRiskDiabetes")?.textContent || "0%";
            const riskStroke = document.getElementById("modalRiskStroke")?.textContent || "0%";
            const symptoms = document.getElementById("refSymptoms")?.textContent || "None";
            const doctorNote = document.getElementById("clinicalFeedbackText")?.value || "";

            return {
                name, age, gender, bloodGroup, bmi, bp, glucose, pulse,
                risks: { heart: riskHeart, diabetes: riskDiabetes, stroke: riskStroke },
                symptoms, doctorNote
            };
        }
        return null;
    }

    setGeneratingState(state) {
        this.isGenerating = state;
        const sendBtn = document.getElementById("chatbotSendBtn");
        const input = document.getElementById("chatbotInput");
        if (sendBtn) sendBtn.disabled = state;
        if (input) input.disabled = state;
    }

    showTypingIndicator() {
        const container = document.getElementById("messagesContainer");
        if (!container || document.getElementById("chatbotTypingBubble")) return;

        const row = document.createElement("div");
        row.className = "chat-msg-row ai";
        row.id = "chatbotTypingBubble";
        row.innerHTML = `
            <div class="chat-bubble ai-bubble typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        container.appendChild(row);
        this.scrollChatToBottom();
    }

    hideTypingIndicator() {
        const bubble = document.getElementById("chatbotTypingBubble");
        if (bubble) bubble.remove();
    }

    scrollChatToBottom() {
        const messagesDiv = document.getElementById("chatbotMessages");
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    escapeHTML(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Instantiate on DOM Loaded
document.addEventListener("DOMContentLoaded", () => {
    new HealthChatbot();
});
