// CENTRAL DATA STORE (THE SOURCE OF TRUTH SKELETON)
export let state = { 
    registry: { subjects: [], teachers: [] }, 
    classes: [], 
    blueprints: { junior: [], senior: [] }, 
    rules: [],
    branding: {
        appName: "Academic Architect",
        schoolName: "GSSS KHALYANI",
        accessPin: "1234" // Default safety pin
    }
};

export let historyStack = [];
export let currentClashMap = {};

// SCHEMA SAFEGUARD VALIDATOR
export function validateState(st) {
    if (!st || typeof st !== 'object') return false;
    if (!Array.isArray(st.rules)) return false;
    if (!Array.isArray(st.classes)) return false;
    if (!st.blueprints || typeof st.blueprints !== 'object') return false;
    if (!st.registry || typeof st.registry !== 'object') return false;
    if (!Array.isArray(st.registry.subjects)) return false;
    if (!Array.isArray(st.registry.teachers)) return false;
    return true;
}

// APPLICATION RECOVERY & BACKUP LOGIC
export function saveStateToHistory() { 
    historyStack.push(JSON.stringify(state)); 
    if(historyStack.length > 20) historyStack.shift(); 
}

export function undo() { 
    if(historyStack.length > 0) { 
        state = JSON.parse(historyStack.pop()); 
        saveToLocalStorage();
        return true;
    } 
    return false; 
}

// HARD DRIVERS DISK CACHE HANDSHAKES
export function saveToLocalStorage() {
    localStorage.setItem('architect_matrix_state', JSON.stringify(state));
}

export function loadStateFromCache() {
    try {
        const saved = localStorage.getItem('architect_matrix_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (validateState(parsed)) {
                state = parsed;
                // Ensure default branding attributes exist if loading older backup schema files
                if (!state.branding) {
                    state.branding = { appName: "Academic Architect", schoolName: "GSSS KHALYANI", accessPin: "1234" };
                }
                return true;
            }
        }
    } catch (e) {
        console.error("Cache handshake interruption corrected safely.", e);
    }
    return false;
}

export function updateBrandingConfig(appName, schoolName, accessPin) {
    saveStateToHistory();
    state.branding.appName = appName || "Academic Architect";
    state.branding.schoolName = schoolName || "GSSS KHALYANI";
    if (accessPin) state.branding.accessPin = accessPin;
    saveToLocalStorage();
}