import { state } from './state.js';
import { adjustState, getLiveTeacherLoad } from './adjustments.js';
import { getRuleDetails, formatTime } from './clash-engine.js';

// DOM HELPER SANITIZERS
const cleanText = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str.trim();
    return temp.innerHTML;
};

const getFullSub = (s) => { const item = state.registry.subjects.find(x => x.s === s); return item ? item.f : s; };
const getFullTea = (s) => { const item = state.registry.teachers.find(x => x.s === s); return item ? item.f : s; };
const getDayLabel = (days) => { const active = []; days.forEach((d, i) => { if (d) active.push(i + 1); }); if (active.length === 0) return "0"; return active.join(','); };

// 1. DAILY SUBSTITUTION MASTER SHEET PRINT MACHINE
export function compileCirculationPrintLayout() {
    const dObj = new Date(adjustState.dateStr);
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dateStrClean = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ` (${dayNames[adjustState.dayIndex].toUpperCase()})`;
    
    let affected = []; 
    state.rules.forEach(r => { 
        if(r.days[adjustState.dayIndex] && adjustState.absent.includes(r.tea)) { 
            const det = getRuleDetails(r); 
            if(det) affected.push({ ...r, ...det }); 
        } 
    });
    affected.sort((a,b) => a.s - b.s);
    
    let rowsHtml = '';
    affected.forEach(aff => {
        const subObj = adjustState.covers[aff.id] ? state.registry.teachers.find(t=>t.s === adjustState.covers[aff.id]) : null;
        const absObj = state.registry.teachers.find(t=>t.s === aff.tea);
        rowsHtml += `<tr>
            <td>${subObj ? `<b>${cleanText(subObj.f)}</b><span class="print-sub-text">${cleanText(subObj.d)||''}</span>` : `<span style="color:#ef4444; font-weight:900;">UNASSIGNED</span>`}</td>
                    <td><b>${cleanText(aff.pName)}</b><span class="print-sub-text">${formatTime(aff.s)} - ${formatTime(aff.e)}</span></td>
            <td>${cleanText(aff.class)}</td><td>${getFullSub(aff.sub)}</td>
            <td>${absObj ? `<b>${cleanText(absObj.f)}</b><span class="print-sub-text">${cleanText(absObj.d)||''}</span>` : getFullTea(aff.tea)}</td>
            <td><div class="print-sig"></div></td></tr>`;
    });
    
    return `<div class="print-header">Daily Substitution Sheet</div>
            <div class="print-meta">
                <div>DATE: <span style="font-weight:400;">${dateStrClean}</span></div>
                <div>ABSENT TEACHERS: <span style="font-weight:900;">${adjustState.absent.map(s => getFullTea(s)).join(', ')}</span></div>
            </div>
            <table class="print-table">
                <thead><tr><th>Substitute</th><th>Period & Time</th><th>Class</th><th>Subject</th><th>Absent</th><th>Signature</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>`;
}

// 2. DAILY SINGLE-PAGE TEACHER SLIPS DOCKET WRITER
export function compileTeacherDailySlipsLayout() {
    const dObj = new Date(adjustState.dateStr);
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dateStrClean = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ` (${dayNames[adjustState.dayIndex].toUpperCase()})`;
    
    let presentTeachers = state.registry.teachers.filter(t => !adjustState.absent.includes(t.s));
    let html = '';
    
    presentTeachers.forEach(tea => {
        let dailyPeriods = [];
        
        state.rules.forEach(r => {
            if (r.tea === tea.s && r.days[adjustState.dayIndex]) {
                const det = getRuleDetails(r);
                if (det) dailyPeriods.push({ ...r, ...det, type: 'REGULAR' });
            }
        });
        
        Object.entries(adjustState.covers).forEach(([rId, subCode]) => {
            if (subCode === tea.s) {
                const cr = state.rules.find(x => x.id === rId);
                if (cr) {
                    const det = getRuleDetails(cr);
                    if (det) dailyPeriods.push({ ...cr, ...det, type: 'COVER', originalTea: cr.tea });
                }
            }
        });
        
        if (dailyPeriods.length === 0) return; 
        dailyPeriods.sort((a,b) => a.s - b.s);
        
        html += `<div class="page-break" style="margin-bottom: 40px; page-break-inside: avoid;">
            <div style="border: 3px solid #000000; padding: 20px; border-radius: 12px; background: #ffffff;">
                <div style="text-align:center; border-bottom: 3px solid #000000; padding-bottom: 10px; margin-bottom: 15px;">
                    <h1 style="font-size:22px; font-weight:900; margin:0; text-transform:uppercase;">DAILY DOCKET: ${cleanText(tea.f)}</h1>
                    <h2 style="font-size:13px; font-weight:900; margin:4px 0 0 0;">${dateStrClean}</h2>
                </div>
                <table style="width:100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000000;">
                            <th style="padding: 8px 4px; font-size:12px; font-weight:900;">TIME</th>
                            <th style="padding: 8px 4px; font-size:12px; font-weight:900;">CLASS</th>
                            <th style="padding: 8px 4px; font-size:12px; font-weight:900;">SUBJECT</th>
                            <th style="padding: 8px 4px; font-size:12px; font-weight:900;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        dailyPeriods.forEach(p => {
            const isCover = p.type === 'COVER';
            const rowStyle = isCover ? 'border: 2px solid #000000; background-color: #f8fafc; font-weight: 900;' : 'border-bottom: 1px solid #cbd5e1;'; 
            const statusText = isCover ? `SUBSTITUTION DUTY (Abs: ${getFullTea(p.originalTea)})` : 'REGULAR CLASS';
            const statusStyle = isCover ? 'font-weight: 900; text-transform: uppercase;' : 'font-weight: 400;';
            
            html += `<tr style="${rowStyle}">
                <td style="padding: 10px 6px; font-size: 12px; font-weight: 900;">${formatTime(p.s)} - ${formatTime(p.e)}<br><span style="font-size:10px; font-weight: 700;">${cleanText(p.pName)}</span></td>
                <td style="padding: 10px 6px; font-size: 15px; font-weight: 900;">${cleanText(p.class)}</td>
                <td style="padding: 10px 6px; font-size: 13px; font-weight: 900;">${getFullSub(p.sub)}</td>
                <td style="padding: 10px 6px; font-size: 11px; ${statusStyle}">${statusText}</td>
            </tr>`;
        });
        
        html += `</tbody></table>
                <div style="margin-top: 25px; text-align: right; font-size: 11px; font-weight: 900; border-top: 1px solid #000000; padding-top: 8px;">${state.branding.appName} Engine</div>
            </div></div>`;
    });
    
    return html;
}

// 3. MASTER DIALOG LOG BATCH REPORTS GENERATORS
export function compileClassReportsLayout(target) {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let html = '';
    let classesToPrint = target === 'ALL' ? state.classes : state.classes.filter(c => c.name === target);
    
    classesToPrint.forEach((cls) => {
        const bp = (state.blueprints[cls.tier] || []).slice().sort((a,b)=>a.s - b.s);
        let usedSubs = new Set(), usedTeas = new Set();
        
        html += `<div class="page-break">
            <div style="text-align:center; margin-bottom:15px;">
                <h1 style="font-size:24px; font-weight:900; margin:0; text-transform:uppercase;">${cleanText(state.branding.schoolName)}</h1>
                <h2 style="font-size:14px; font-weight:700; margin:5px 0 0 0; color:#000000; text-transform:uppercase;">CLASS TIMETABLE: ${cleanText(cls.name)}</h2>
            </div>
            <table class="report-table">
                <thead><tr><th>DAY</th>`;
                
        bp.forEach(p => { html += `<th>${cleanText(p.n)}<br><span style="font-size:8px;font-weight:normal;">${formatTime(p.s)} - ${formatTime(p.e)}</span></th>`; });
        html += `</tr></thead><tbody>`;
        
        for(let d=0; d<6; d++) {
            html += `<tr><td><b>${dayNames[d].substring(0,3).toUpperCase()}</b></td>`;
            bp.forEach(p => {
                if(p.r) {
                    if(d === 0) html += `<td rowspan="6" class="recess-col">RECESS</td>`;
                } else {
                    let matchingRules = state.rules.filter(r => r.class === cls.name && r.periodId === p.id && r.days[d]);
                    if(matchingRules.length > 0) {
                        html += `<td><div style="display:flex; gap:6px; justify-content:center; align-items:center; min-height:36px;">`;
                        matchingRules.forEach((rule, idx) => {
                            if(rule.sub) usedSubs.add(rule.sub); 
                            if(rule.tea) usedTeas.add(rule.tea);
                            let borderStyle = idx < matchingRules.length - 1 ? 'border-right:1px dashed #cbd5e1; padding-right:6px;' : '';
                            html += `<div style="${borderStyle} flex:1; min-width:0; text-align:center;">
                                <b style="font-size:12px; display:block;">${cleanText(rule.sub)||'-'}</b>
                                <span style="font-size:9px; font-weight:bold; display:block;">${cleanText(rule.tea)||'-'}</span>
                            </div>`;
                        });
                        html += `</div></td>`;
                    } else {
                        html += `<td style="color:#000000; font-size:10px; font-weight:bold;">- FREE -</td>`;
                    }
                }
            });
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        
        let subLeg = Array.from(usedSubs).map(s => `<b>${cleanText(s)}</b>: ${getFullSub(s)}`).join(' | ');
        let teaLeg = Array.from(usedTeas).map(t => `<b>${cleanText(t)}</b>: ${getFullTea(t)}`).join(' | ');
        html += `<div style="margin-top:10px; font-size:10px; border-top:2px solid #000000; padding-top:4px; text-align:center; font-weight:700;">`;
        if(subLeg) html += `[SUBJECTS] ${subLeg} &nbsp;&nbsp;||&nbsp;&nbsp; `;
        if(teaLeg) html += `[TEACHERS] ${teaLeg}`;
        html += `</div></div>`;
    });
    return html;
}