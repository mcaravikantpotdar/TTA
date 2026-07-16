import { state } from './state.js';

// CHRONOLOGICAL TIME UNIT CONVERTERS
export const formatTime = (m) => { 
    const h = Math.floor(m / 60) % 12 || 12, mins = m % 60, p = m >= 720 ? 'PM' : 'AM'; 
    return `${h}:${String(mins).padStart(2, '0')}${p}`; 
};

export const timeToMin = (t) => { 
    if (!t) return 0; 
    const [h, m] = t.split(':').map(Number); 
    return h * 60 + m; 
};

export const minToTime = (m) => { 
    const h = Math.floor(m / 60), mins = m % 60; 
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`; 
};

// DATA LINKAGE MAPPER
export function getRuleDetails(r) {
    if (!r) return null;
    const cls = state.classes.find(c => c.name === r.class);
    if (!cls || !cls.tier) return null;
    
    const tierBlueprint = state.blueprints[cls.tier];
    if (!tierBlueprint || !Array.isArray(tierBlueprint)) return null;
    
    const p = tierBlueprint.find(x => x.id === r.periodId);
    if (!p || p.s === undefined || p.e === undefined) return null;
    
    return { clsTier: cls.tier, pName: p.n, s: Number(p.s), e: Number(p.e) };
}

// SYMMETRICAL CONFLICT RULES CHECKER
export function checkClash(tea, day, clsName, pId, exId) { 
    if (!tea || !state.classes || !state.blueprints || !state.rules) return false; 
    const cls = state.classes.find(c => c.name === clsName); if (!cls) return false; 
    const p = state.blueprints[cls.tier] && state.blueprints[cls.tier].find(x => x.id === pId); if (!p) return false; 
    
    for (let r of state.rules) { 
        if (!r || r.id === exId || r.tea !== tea || !r.days || !r.days[day]) continue; 
        // Symmetrical Combined Class Check (e.g. intentional CCA double-booking)
        if ((r.sub === 'CCA' || r.sub === 'CCA') && clsName !== r.class) continue;
        
        const rDet = getRuleDetails(r);
        if (!rDet) continue; 
        if (Number(p.s) < Number(rDet.e) && Number(p.e) > Number(rDet.s)) return true; 
    } 
    return false; 
}