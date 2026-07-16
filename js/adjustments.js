import { state, saveStateToHistory, saveToLocalStorage } from './state.js';
import { getRuleDetails, checkClash, formatTime } from './clash-engine.js';

// DAILY WORKFLOW STATE CONTAINER
export let adjustState = { 
    dateStr: '', 
    dayIndex: -1, 
    absent: [], 
    covers: {}, 
    excludedTeachers: [], 
    draggedSub: null 
};

// LIVE OPERATION ANALYTICS
export function getLiveTeacherLoad(teaCode) { 
    let masterLoad = 0; 
    state.rules.forEach(r => { 
        if (r.tea === teaCode && r.days[adjustState.dayIndex]) masterLoad++; 
    }); 
    let coverLoad = Object.values(adjustState.covers).filter(v => v === teaCode).length; 
    return masterLoad + coverLoad; 
}

// TEMPORAL PROXIMITY CALCULATOR (FATIGUE PREVENTION RADAR)
export function checkAdjacentEngagement(teaCode, startMin, endMin) {
    const buffer = 2; // Tolerance padding minutes
    let adjacentFound = state.rules.some(r => {
        if (r.tea !== teaCode || !r.days[adjustState.dayIndex]) return false;
        const d = getRuleDetails(r);
        return d && (Math.abs(d.e - startMin) <= buffer || Math.abs(d.s - endMin) <= buffer);
    });
    if (adjacentFound) return true;
    
    return Object.entries(adjustState.covers).some(([rId, sCode]) => {
        if (sCode !== teaCode) return false;
        const cr = state.rules.find(x => x.id === rId);
        if (!cr) return false;
        const d = getRuleDetails(cr);
        return d && (Math.abs(d.e - startMin) <= buffer || Math.abs(d.s - endMin) <= buffer);
    });
}

// EXCLUSION VETO MAPPER
export function toggleTeacherVeto(teaShort) {
    if (adjustState.excludedTeachers.includes(teaShort)) {
        adjustState.excludedTeachers = adjustState.excludedTeachers.filter(x => x !== teaShort);
    } else {
        adjustState.excludedTeachers.push(teaShort);
    }
}

export function removeCover(ruleId) { 
    delete adjustState.covers[ruleId]; 
}

export function clearAllCovers() { 
    adjustState.covers = {}; 
}