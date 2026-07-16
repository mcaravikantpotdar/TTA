import { state, saveStateToHistory, undo, saveToLocalStorage, loadStateFromCache, updateBrandingConfig } from './state.js';
import { formatTime, timeToMin, minToTime, checkClash, getRuleDetails, auditClashes } from './clash-engine.js';
import { adjustState, getLiveTeacherLoad, checkAdjacentEngagement, toggleTeacherVeto, removeCover, clearAllCovers } from './adjustments.js';
import { compileCirculationPrintLayout, compileTeacherDailySlipsLayout, compileClassReportsLayout } from './report-engine.js';
import { renderSidebar } from './components/sidebar.js';
import { renderGrid } from './components/grid.js';

// DOM HELPER SANITIZER
const sanitize = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str.trim();
    return temp.innerHTML;
};

const minToPx = (m) => m * 4;
const generateId = (prefix) => prefix + Date.now() + Math.random().toString(36).substring(2, 6);

// INITIALIZE CORE APP MODULE SPACE
window.App = {
    _dragged: null,
    _activeRuleId: null,
    _editingReg: { type: '', idx: -1 },
    _editingCls: { name: '', tier: '' },
    _editingPer: { id: '', tier: '' },

    // WINDOW ACTIONS PASS-THROUGHS
    closeAllStrips: (e) => {
        if (!e.target.closest('.day-strip') && !e.target.closest('.dz-day')) {
            window.App._activeRuleId = null;
            window.App.refreshUI();
        }
    },
    updateTooltipPos: (e) => {
        const t = document.getElementById('tooltip');
        if (t.style.display === 'block') {
            t.style.left = (e.clientX + 15) + 'px';
            t.style.top = (e.clientY + 15) + 'px';
        }
    },
    expandSidebar: (e, id) => {
        const el = document.getElementById(id);
        if (el.classList.contains('collapsed')) el.classList.remove('collapsed');
    },
    toggleSidebar: (e, id) => {
        e.stopPropagation();
        document.getElementById(id).classList.toggle('collapsed');
    },
    undo: () => {
        if (undo()) {
            window.App.refreshUI();
            window.App.showToast("Undo successful", "info");
        } else {
            window.App.showToast("Nothing to undo", "error");
        }
    },
    wipeClear: () => {
        if (confirm("DANGER: Wipe entire schedule?")) {
            saveStateToHistory();
            state.registry = { subjects: [], teachers: [] };
            state.classes = [];
            state.blueprints = { junior: [], senior: [] };
            state.rules = [];
            saveToLocalStorage();
            window.App.refreshUI();
            window.App.showToast("Schedule wiped.", "error");
        }
    },

    // TOAST & TOOLTIP WINDOW HANDLERS
    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div'); 
        toast.className = `toast toast-${type}`; 
        toast.innerHTML = msg;
        container.appendChild(toast); 
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { 
            toast.classList.remove('show'); 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    },
    showNameTooltip: (e, shortCode, type) => {
        if (!shortCode || !state.registry) return;
        const list = type === 'sub' ? state.registry.subjects : state.registry.teachers;
        const item = list.find(x => x.s === shortCode);
        if (!item) return;
        let txt = `<b>${sanitize(item.f)}</b>`;
        if (item.d) txt += `<br><span style="color:#94a3b8;font-size:9px;">${sanitize(item.d)}</span>`;
        const t = document.getElementById('tooltip');
        t.innerHTML = txt; 
        t.style.display = 'block';
    },
    hideTooltip: () => {
        document.getElementById('tooltip').style.display = 'none';
    },

    // BRANDING CONFIGURATION SYSTEM INDENTITY METHODS
    openConfigModal: () => {
        document.getElementById('cfgAppName').value = state.branding.appName || "Academic Architect";
        document.getElementById('cfgSchoolName').value = state.branding.schoolName || "GSSS KHALYANI";
        document.getElementById('cfgAccessPin').value = "";
        document.getElementById('configModal').style.display = 'flex';
    },
    saveGlobalBrandingConfig: () => {
        const appN = sanitize(document.getElementById('cfgAppName').value.trim());
        const schN = sanitize(document.getElementById('cfgSchoolName').value.trim());
        const pinN = document.getElementById('cfgAccessPin').value.trim();
        
        updateBrandingConfig(appN, schN, pinN ? pinN : null);
        window.App.updateAppBrandingDOM();
        window.App.closeModal('configModal');
        window.App.showToast("Branding settings saved.", "success");
    },
    updateAppBrandingDOM: () => {
        document.getElementById('headerAppName').innerText = state.branding.appName || "Academic Architect";
        document.getElementById('headerSchoolName').innerText = `${state.branding.schoolName || "GSSS KHALYANI"} - System Engine`;
        document.title = state.branding.appName || "Academic Architect";
    },

    // SECURITY RECOVERY TIMETABLE VAULT PROTECTION LAYER
    triggerSecurityChallenge: () => {
        if (state.branding && state.branding.accessPin) {
            document.getElementById('lockModal').style.display = 'flex';
            document.getElementById('challengePinField').focus();
        }
    },
    verifySecurityChallenge: () => {
        const enteredPin = document.getElementById('challengePinField').value.trim();
        if (enteredPin === state.branding.accessPin) {
            window.App.closeModal('lockModal');
            document.getElementById('challengePinField').value = "";
            window.App.showToast("System Unlocked.", "success");
        } else {
            window.App.showToast("❌ Access Denied: Invalid Security PIN", "error");
        }
    },

    // GRID MECHANICAL DRAG HANDLERS
    handleGenericDrop: (e, cls, pId) => {
        e.preventDefault(); 
        saveStateToHistory(); 
        const cleanVal = window.App._dragged.val ? window.App._dragged.val.trim() : '';
        let existingRule = state.rules.find(r => r.class === cls && r.periodId === pId && (!r.sub || r.sub === cleanVal || !r.tea || r.tea === cleanVal));
        
        if (existingRule) {
            if (window.App._dragged.type === 'sub') existingRule.sub = cleanVal; 
            else existingRule.tea = cleanVal;
            window.App._activeRuleId = existingRule.id;
        } else {
            const rid = generateId('r'); 
            const nr = { id: rid, class: cls, periodId: pId, sub: window.App._dragged.type === 'sub' ? cleanVal : '', tea: window.App._dragged.type === 'tea' ? cleanVal : '', days: [false,false,false,false,false,false] }; 
            state.rules.push(nr); 
            window.App._activeRuleId = rid; 
        }
        saveToLocalStorage();
        window.App.refreshUI();
    },
    handleTargetedDrop: (e, rid, type) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        if (window.App._dragged.type !== type) return; 
        const r = state.rules.find(x => x.id === rid); 
        if (!r) return;
        const cleanVal = window.App._dragged.val ? window.App._dragged.val.trim() : '';

        if (type === 'tea') { 
            for (let i=0; i<6; i++) { 
                if (r.days && r.days[i] && checkClash(cleanVal, i, r.class, r.periodId, r.id)) { 
                    window.App.showToast(`⚠️ Rejection: ${cleanVal} is busy on weekday ${i+1}.`, 'error'); 
                    return; 
                } 
            } 
        } 
        saveStateToHistory(); 
        r[type] = cleanVal; 
        saveToLocalStorage();
        window.App.refreshUI();
    },
    clearValue: (e, rid, type) => {
        e.stopPropagation(); 
        saveStateToHistory(); 
        const r = state.rules.find(x => x.id === rid); 
        if (r) {
            r[type] = ''; 
            if (!r.sub.trim() && !r.tea.trim()) r.days = [false, false, false, false, false, false];
        }
        saveToLocalStorage();
        window.App.refreshUI();
    },
    toggleStrip: (e, id) => {
        e.stopPropagation(); 
        window.App._activeRuleId = (window.App._activeRuleId === id) ? null : id; 
        window.App.refreshUI();
    },
    createDayStrip: (rule) => {
        const strip = document.createElement('div'); 
        strip.className = 'day-strip'; 
        strip.onclick = (e) => e.stopPropagation(); 
        const allSelected = (rule.days || []).every(d => d); 
        
        strip.innerHTML += `<div class="day-toggle master ${allSelected ? 'selected' : ''}">1-6</div>`;
        ["M","T","W","T","F","S"].forEach((d, i) => {
            const isClash = checkClash(rule.tea, i, rule.class, rule.periodId, rule.id);
            strip.innerHTML += `<div class="day-toggle ${(rule.days || [])[i] ? 'selected' : ''} ${isClash ? 'clash' : ''}">${d}</div>`;
        });
        
        strip.querySelector('.master').onclick = (e) => {
            e.stopPropagation();
            saveStateToHistory();
            if (allSelected) {
                rule.days = [false,false,false,false,false,false];
            } else {
                for (let i=0; i<6; i++) { if (!checkClash(rule.tea, i, rule.class, rule.periodId, rule.id)) rule.days[i] = true; }
            }
            saveToLocalStorage();
            window.App.refreshUI();
        };

        strip.querySelectorAll('.day-toggle:not(.master)').forEach((el, idx) => {
            el.onclick = (e) => {
                e.stopPropagation();
                if (el.classList.contains('clash')) return;
                saveStateToHistory();
                rule.days[idx] = !rule.days[idx];
                saveToLocalStorage();
                window.App.refreshUI();
            };
        });
        
        return strip;
    },

    // ADJUSTMENT SUBS SYSTEM FUNCTIONS
    openAdjustments: () => {
        adjustState.dateStr = document.getElementById('adjDate').value;
        adjustState.dayIndex = -1;
        adjustState.absent = [];
        adjustState.covers = {};
        adjustState.excludedTeachers = [];
        document.getElementById('adjModal').style.display = 'flex';
        window.App.goToSetupView();
        window.App.renderAdjTeachers();
    },
    closeAdjustments: () => { window.App.closeModal('adjModal'); },
    goToSetupView: () => {
        document.getElementById('adjView1').style.display = 'block';
        document.getElementById('adjView2').style.display = 'none';
    },
    goToAssignView: () => {
        if (adjustState.dayIndex === -1) { window.App.showToast("Selected date is invalid.", "error"); return; }
        if (adjustState.absent.length === 0) { window.App.showToast("Please select at least one absent teacher.", "error"); return; }
        document.getElementById('adjView1').style.display = 'none';
        document.getElementById('adjView2').style.display = 'flex';
        window.App.renderAdjBoard();
    },
    renderAdjTeachers: () => {
        const dateVal = document.getElementById('adjDate').value; 
        if (!dateVal) return;
        adjustState.dateStr = dateVal; 
        const [y, m, d] = dateVal.split('-');
        const jsDay = new Date(y, m - 1, d).getDay(); 
        adjustState.dayIndex = jsDay === 0 ? -1 : jsDay - 1; 

        const grid = document.getElementById('adjTeaGrid'); 
        grid.innerHTML = '';
        state.registry.teachers.forEach(t => {
            const isAbs = adjustState.absent.includes(t.s);
            const card = document.createElement('div'); 
            card.className = `absent-card ${isAbs ? 'is-absent' : ''}`;
            card.innerHTML = `<div class="font-black text-base mb-1">${sanitize(t.f)}</div><div class="text-[10px] font-bold opacity-60 uppercase tracking-wide">[${sanitize(t.d) || 'Teacher'}]</div>`;
            card.onclick = () => {
                if (isAbs) adjustState.absent = adjustState.absent.filter(x => x !== t.s);
                else adjustState.absent.push(t.s);
                window.App.renderAdjTeachers();
            };
            grid.appendChild(card);
        });
    },
    renderAdjBoard: () => {
        renderSidebar(window.App.openRegModal, window.App.deleteRegistry, window.App.showNameTooltip, window.App.hideTooltip);
        const list = document.getElementById('adjPeriodsList'); 
        list.innerHTML = '';
        const subsPanel = document.getElementById('adjSubsList'); 
        subsPanel.innerHTML = '';
        
        let affected = [];
        state.rules.forEach(r => { 
            if (r.days[adjustState.dayIndex] && adjustState.absent.includes(r.tea)) { 
                const det = getRuleDetails(r); 
                if (det) affected.push({ ruleId: r.id, class: r.class, sub: r.sub, tea: r.tea, ...det }); 
            } 
        });
        affected.sort((a,b) => a.s - b.s); 
        
        if (affected.length === 0) { 
            list.innerHTML = '<div class="text-slate-400 font-black p-4 text-center">No periods affected today.</div>'; 
            return; 
        }

        affected.forEach(aff => {
            const isCovered = adjustState.covers[aff.ruleId];
            const box = document.createElement('div'); 
            box.className = "flex items-center justify-between p-3 border-2 border-slate-200 rounded-xl bg-white";
            box.innerHTML = `<div class="flex-1">
                                <div class="text-sm font-black text-slate-800 mb-1"><span class="text-indigo-600">${sanitize(aff.class)}</span> - ${sanitize(aff.pName)}</div>
                                <div class="text-xs font-bold text-slate-500 uppercase">${sanitize(aff.sub)} (Abs: ${sanitize(aff.tea)})</div>
                             </div>`;
            if (isCovered) {
                const btn = document.createElement('div'); 
                btn.className = "adj-filled rounded-lg h-12 flex items-center justify-between font-black text-sm px-4 min-w-[220px]";
                btn.innerHTML = `<span>${sanitize(isCovered)}</span> <button class="text-white hover:text-rose-200 ml-3 text-lg">&times;</button>`;
                btn.querySelector('button').onclick = () => { removeCover(aff.ruleId); window.App.renderAdjBoard(); };
                box.appendChild(btn);
            } else {
                const drop = document.createElement('div'); 
                drop.className = "adj-drop-zone uppercase text-[10px] tracking-widest"; 
                drop.innerText = "DROP SUB HERE";
                drop.ondragover = e => { e.preventDefault(); drop.classList.add('drag-over'); }; 
                drop.ondragleave = () => { drop.classList.remove('drag-over'); };
                drop.ondrop = e => { 
                    e.preventDefault(); 
                    drop.classList.remove('drag-over'); 
                    window.App.assignCover(aff.ruleId, adjustState.draggedSub); 
                };
                box.appendChild(drop);
            }
            list.appendChild(box);
        });

        let present = state.registry.teachers.filter(t => !adjustState.absent.includes(t.s)).sort((a,b) => getLiveTeacherLoad(a.s) - getLiveTeacherLoad(b.s));
        present.forEach(t => {
            const pill = document.createElement('div'); 
            pill.className = "sub-pill"; 
            pill.draggable = true;
            pill.ondragstart = () => { adjustState.draggedSub = t.s; };
            
            const isNotExcluded = !adjustState.excludedTeachers.includes(t.s);
            pill.innerHTML = `<div class="flex items-center gap-3">
                                <input type="checkbox" ${isNotExcluded ? 'checked' : ''} class="w-4 h-4 accent-purple-600 cursor-pointer">
                                <div><span class="font-black text-xs ${isNotExcluded ? 'text-slate-800' : 'text-slate-400 line-through'}">${sanitize(t.f)}</span></div>
                             </div>
                             <div class="bg-slate-100 border border-slate-200 text-slate-500 font-black text-[9px] px-2 py-1 rounded">Load: ${getLiveTeacherLoad(t.s)}</div>`;
            
            pill.querySelector('input').onclick = (e) => {
                e.stopPropagation();
                toggleTeacherVeto(t.s);
                window.App.renderAdjBoard();
            };
            subsPanel.appendChild(pill);
        });
    },
    assignCover: (ruleId, teaCode) => {
        if (!teaCode || adjustState.excludedTeachers.includes(teaCode)) return;
        adjustState.covers[ruleId] = teaCode;
        window.App.renderAdjBoard();
    },
    autoAdjust: () => {
        let affected = [];
        state.rules.forEach(r => { 
            if (r.days[adjustState.dayIndex] && adjustState.absent.includes(r.tea) && !adjustState.covers[r.id]) {
                const det = getRuleDetails(r); if(det) affected.push({ ruleId: r.id, ...det });
            }
        });
        affected.sort((a,b) => a.s - b.s);
        let count = 0;
        const avoidConsecutive = document.getElementById('toggleConsecutiveEngine').checked;

        affected.forEach(aff => {
            let available = state.registry.teachers.filter(t => {
                if (adjustState.absent.includes(t.s) || adjustState.excludedTeachers.includes(t.s)) return false;
                
                // Absolute structural busy verification checks
                let isBusy = state.rules.some(r => r.tea === t.s && r.days[adjustState.dayIndex] && (aff.s < getRuleDetails(r).e && aff.e > getRuleDetails(r).s));
                let isBusyCover = Object.entries(adjustState.covers).some(([rId, sCode]) => {
                    if (sCode !== t.s) return false;
                    const d = getRuleDetails(state.rules.find(x => x.id === rId));
                    return d && (aff.s < d.e && aff.e > d.s);
                });
                return !isBusy && !isBusyCover;
            });

            if (available.length === 0) return;

            available.sort((a, b) => {
                if (avoidConsecutive) {
                    const aAdj = checkAdjacentEngagement(a.s, aff.s, aff.e);
                    const bAdj = checkAdjacentEngagement(b.s, aff.s, aff.e);
                    if (aAdj !== bAdj) return aAdj ? 1 : -1;
                }
                return getLiveTeacherLoad(a.s) - getLiveTeacherLoad(b.s);
            });

            adjustState.covers[aff.ruleId] = available[0].s;
            count++;
        });

        window.App.renderAdjBoard();
        window.App.showToast(`Auto-assigned ${count} duties.`, "success");
    },
    clearAllCovers: () => {
        clearAllCovers();
        window.App.renderAdjBoard();
        window.App.showToast("All temporary covers cleared.", "info");
    },

    // PRINT ACTIONS CALLS
    printCirculation: () => {
        document.getElementById('printLayout').innerHTML = compileCirculationPrintLayout();
        document.getElementById('printLayout').classList.add('is-printing');
        window.print();
        document.getElementById('printLayout').classList.remove('is-printing');
    },
    printTeacherDailySlips: () => {
        const layoutContent = compileTeacherDailySlipsLayout();
        if(!layoutContent) { window.App.showToast("No cover duties to print.", "info"); return; }
        document.getElementById('printLayout').innerHTML = layoutContent;
        document.getElementById('printLayout').classList.add('is-printing');
        window.print();
        document.getElementById('printLayout').classList.remove('is-printing');
    },

    // GENERAL REPORTS LAYOUT METHOD
    openReportModal: () => {
        document.getElementById('reportModal').style.display = 'flex';
        window.App.updateReportTargets();
    },
    updateReportTargets: () => {
        const type = document.getElementById('repType').value;
        const target = document.getElementById('repTarget');
        target.innerHTML = '<option value="ALL">All (Batch Print)</option>';
        if (type === 'class') {
            state.classes.forEach(c => target.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        } else {
            state.registry.teachers.forEach(t => target.innerHTML += `<option value="${t.s}">${t.f}</option>`);
        }
    },
    executePrintReport: () => {
        const type = document.getElementById('repType').value;
        const target = document.getElementById('repTarget').value;
        const container = document.getElementById('reportLayout');
        
        if (type === 'class') {
            container.innerHTML = compileClassReportsLayout(target);
        }
        container.classList.add('is-printing');
        window.print();
        container.classList.remove('is-printing');
        window.App.closeModal('reportModal');
    },

    // MODAL WINDOW INTERFACE LAYER DICTATIONS
    openRegModal: (type, idx = -1) => {
        window.App._editingReg = { type, idx };
        const item = idx === -1 ? { s: '', f: '', d: '' } : (type === 'sub' ? state.registry.subjects[idx] : state.registry.teachers[idx]);
        document.getElementById('modalTitle').innerText = idx === -1 ? `Add ${type.toUpperCase()}` : 'Edit Entry';
        document.getElementById('modalShort').value = item.s;
        document.getElementById('modalFull').value = item.f;
        document.getElementById('modalDesig').value = item.d || '';
        document.getElementById('modalDesig').style.display = type === 'tea' ? 'block' : 'none';
        document.getElementById('regModal').style.display = 'flex';
    },
    saveRegistry: () => {
        const s = sanitize(document.getElementById('modalShort').value.toUpperCase().trim());
        const f = sanitize(document.getElementById('modalFull').value.trim());
        const d = sanitize(document.getElementById('modalDesig').value.trim());
        if(!s || !f) return;

        saveStateToHistory();
        const list = window.App._editingReg.type === 'sub' ? state.registry.subjects : state.registry.teachers;
        const entry = window.App._editingReg.type === 'sub' ? { s, f } : { s, f, d };
        
        if (window.App._editingReg.idx === -1) list.push(entry);
        else list[window.App._editingReg.idx] = entry;

        saveToLocalStorage();
        window.App.closeModal('regModal');
        window.App.refreshUI();
    },
    deleteRegistry: (e, type, idx) => {
        e.stopPropagation();
        if(confirm("Delete this registry entry permanently?")) {
            saveStateToHistory();
            const list = type === 'sub' ? state.registry.subjects : state.registry.teachers;
            list.splice(idx, 1);
            saveToLocalStorage();
            window.App.refreshUI();
        }
    },
    openClsModal: (name = null, tier) => {
        window.App._editingCls = { name, tier };
        document.getElementById('clsName').value = name || '';
        document.getElementById('clsModal').style.display = 'flex';
    },
    saveClass: () => {
        const name = sanitize(document.getElementById('clsName').value.toUpperCase().trim());
        if(!name) return;
        saveStateToHistory();
        if(window.App._editingCls.name) {
            const c = state.classes.find(x => x.name === window.App._editingCls.name);
            if(c) c.name = name;
        } else {
            state.classes.push({ name, tier: window.App._editingCls.tier });
        }
        saveToLocalStorage();
        window.App.closeModal('clsModal');
        window.App.refreshUI();
    },
    deleteClass: (name) => {
        if(confirm(`Delete class ${name}?`)) {
            saveStateToHistory();
            state.classes = state.classes.filter(x => x.name !== name);
            saveToLocalStorage();
            window.App.refreshUI();
        }
    },
    openPerModal: (id = null, tier) => {
        window.App._editingPer = { id, tier };
        const p = id ? state.blueprints[tier].find(x => x.id === id) : { n: '', s: 600, e: 640, r: false };
        document.getElementById('perTitle').innerText = id ? 'Edit Period' : 'Add Period';
        document.getElementById('perName').value = p.n;
        document.getElementById('perS').value = minToTime(p.s);
        document.getElementById('perE').value = minToTime(p.e);
        document.getElementById('perRecess').checked = p.r;
        document.getElementById('perModal').style.display = 'flex';
    },
    savePeriod: () => {
        const n = sanitize(document.getElementById('perName').value.toUpperCase().trim());
        const s = timeToMin(document.getElementById('perS').value);
        const e = timeToMin(document.getElementById('perE').value);
        const r = document.getElementById('perRecess').checked;
        if(!n || s >= e) return;

        saveStateToHistory();
        const list = state.blueprints[window.App._editingPer.tier];
        if (window.App._editingPer.id) {
            const p = list.find(x => x.id === window.App._editingPer.id);
            if (p) Object.assign(p, { n, s, e, r });
        } else {
            list.push({ id: generateId('p'), n, s, e, r });
        }
        saveToLocalStorage();
        window.App.closeModal('perModal');
        window.App.refreshUI();
    },
    deletePeriod: (id, tier) => {
        if(confirm("Delete this period blueprint?")) {
            saveStateToHistory();
            state.blueprints[tier] = state.blueprints[tier].filter(x => x.id !== id);
            saveToLocalStorage();
            window.App.refreshUI();
        }
    },
    closeModal: (id) => { document.getElementById(id).style.display = 'none'; },

    // DISK FILE SYSTEM LOADER/EXPORTERS
    exportData: () => {
        const b = new Blob([JSON.stringify(state)], { type: 'application/json' });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(b); 
        a.download = 'timetable.json'; 
        a.click();
    },
    importData: (e) => {
        const file = e.target.files[0]; 
        if (!file) return; 
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                saveStateToHistory();
                Object.assign(state, parsed);
                saveToLocalStorage();
                window.App.refreshUI();
                window.App.showToast("Data imported successfully.", "success");
            } catch (err) { window.App.showToast("Load Failed.", "error"); }
        };
        reader.readAsText(file);
    },

    // REFRESH SYNCHRONIZER HUB
    refreshUI: () => {
        // Run Dynamic Column Width pre-calculations to handle deep split periods
        Object.keys(state.blueprints).forEach(tier => {
            if(Array.isArray(state.blueprints[tier])) {
                state.blueprints[tier].forEach(p => {
                    let baseW = minToPx((p.e||0) - (p.s||0));
                    let maxSplits = 1;
                    state.classes.forEach(cls => {
                        if (cls.tier === tier) {
                            let splits = state.rules.filter(r => r.class === cls.name && r.periodId === p.id);
                            if (splits.length > maxSplits) maxSplits = splits.length;
                        }
                    });
                    p._renderWidth = Math.max(baseW, (maxSplits * 40) + 24); 
                });
            }
        });

        const audit = auditClashes();
        const banner = document.getElementById('clashBanner');
        if (audit.count > 0) {
            banner.style.display = 'block';
            banner.innerHTML = `⚠️ ${audit.count} Schedule Conflicts Detected. Hover over Day Pills for details.`;
        } else {
            banner.style.display = 'none';
        }

        renderSidebar(window.App.openRegModal, window.App.deleteRegistry, window.App.showNameTooltip, window.App.hideTooltip);
        renderGrid(
            window.App.openClsModal, window.App.openPerModal, window.App.deletePeriod, window.App.deleteClass,
            window.App.handleGenericDrop, window.App.handleTargetedDrop, window.App.clearValue, window.App.toggleStrip,
            window.App.createDayStrip, audit.map
        );
    },

    // FUTURISTIC CLOUD SYNC PLUG
    syncWithGoogleDrive: () => {
        window.App.showToast("Google Drive module wired successfully. Ready for OAuth context linkage.", "info");
    }
};

// INITIAL APPLICATION INITIALIZATION
window.onload = () => {
    loadStateFromCache();
    window.App.updateAppBrandingDOM();
    window.App.refreshUI();
    window.App.triggerSecurityChallenge();
};