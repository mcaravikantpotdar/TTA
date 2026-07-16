import { state } from '../state.js';
import { getRuleDetails, formatTime, auditClashes } from '../clash-engine.js';

// DOM HELPER SANITIZERS
const cleanText = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str.trim();
    return temp.innerHTML;
};

const minToPx = (m) => m * 4;
const getDayLabel = (days) => { 
    const active = []; 
    days.forEach((d, i) => { if (d) active.push(i + 1); }); 
    if (active.length === 0) return "0"; 
    return active.join(','); 
};

// MASTER CANVAS RENDERER LOOP
export function renderGrid(openClsModalFn, openPerModalFn, deletePeriodFn, deleteClassFn, handleGenericDropFn, handleTargetedDropFn, clearValueFn, toggleStripFn, createDayStripFn, clashMap) {
    const grid = document.getElementById('mainGrid'); 
    grid.innerHTML = '';
    
    let currentTier = null;
    state.classes.forEach(cls => {
        if (!cls || !cls.tier) return;
        if (cls.tier !== currentTier) { 
            currentTier = cls.tier; 
            grid.appendChild(createHeader(currentTier, openClsModalFn, openPerModalFn, deletePeriodFn)); 
        }
        grid.appendChild(createRow(cls, clashMap, openClsModalFn, deleteClassFn, handleGenericDropFn, handleTargetedDropFn, clearValueFn, toggleStripFn, createDayStripFn));
    });
    
    if(!state.classes.some(c => c.tier === 'junior')) {
        grid.appendChild(createHeader('junior', openClsModalFn, openPerModalFn, deletePeriodFn));
    }
    if(!state.classes.some(c => c.tier === 'senior')) {
        grid.appendChild(createHeader('senior', openClsModalFn, openPerModalFn, deletePeriodFn));
    }
}

function createHeader(tier, openClsModalFn, openPerModalFn, deletePeriodFn) {
    const row = document.createElement('div'); 
    row.className = 'period-header architect-row';
    row.innerHTML = `<div class="label-box bg-slate-900 border-r-4 border-black text-[10px] text-white flex justify-between px-3 box-border" style="width: var(--label-width)">
                        <span>${(tier||'').toUpperCase()} TIER</span>
                        <button class="text-white hover:text-indigo-300 font-black text-lg leading-none" data-action="add-cls" title="Add Class to Tier">+</button>
                     </div>`;
                     
    if(state.blueprints && Array.isArray(state.blueprints[tier])) {
        state.blueprints[tier].forEach(p => {
            const div = document.createElement('div'); 
            div.className = 'p-block'; 
            div.style.width = (p._renderWidth || minToPx((p.e||0) - (p.s||0))) + 'px';
            div.innerHTML = `${cleanText(p.n)} <span>${formatTime(p.s||0)}-${formatTime(p.e||0)}</span>
                             <div class="hover-actions bg-black/60 p-1 rounded backdrop-blur">
                                 <i class="icon-btn text-white" data-action="edit-per">✎</i>
                                 <i class="icon-btn text-red-400" data-action="delete-per">🗑</i>
                             </div>`;
                             
            div.querySelector('[data-action="edit-per"]').onclick = () => openPerModalFn(p.id, tier);
            div.querySelector('[data-action="delete-per"]').onclick = () => deletePeriodFn(p.id, tier);
            row.appendChild(div);
        });
    }
    
    const tierAdd = document.createElement('div'); 
    tierAdd.className = 'flex items-center px-4 cursor-pointer hover:bg-white/10 flex-shrink-0'; 
    tierAdd.innerHTML = `<span class="text-xl font-black">+</span>`; 
    tierAdd.onclick = () => openPerModalFn(null, tier);
    
    row.querySelector('[data-action="add-cls"]').onclick = () => openClsModalFn(null, tier);
    row.appendChild(tierAdd); 
    return row;
}

function createRow(cls, clashMap, openClsModalFn, deleteClassFn, handleGenericDropFn, handleTargetedDropFn, clearValueFn, toggleStripFn, createDayStripFn) {
    const row = document.createElement('div'); 
    row.className = 'architect-row';
    const safeClassName = cleanText(cls.name);
    row.innerHTML = `<div class="label-box relative" data-class-name="${safeClassName}">${safeClassName}
                        <div class="hover-actions">
                            <i class="icon-btn text-indigo-600" data-action="edit-cls">✎</i>
                            <i class="icon-btn text-rose-600" data-action="delete-cls">🗑</i>
                        </div>
                     </div>`;
                     
    row.querySelector('[data-action="edit-cls"]').onclick = () => openClsModalFn(safeClassName, cls.tier);
    row.querySelector('[data-action="delete-cls"]').onclick = () => deleteClassFn(safeClassName);
    
    if(state.blueprints && Array.isArray(state.blueprints[cls.tier])) {
        state.blueprints[cls.tier].forEach(p => {
            const cell = document.createElement('div'); 
            const calcWidth = (p._renderWidth || minToPx((p.e||0) - (p.s||0))) + 'px';
            
            if (p.r) { 
                cell.className = 'recess-block'; 
                cell.innerText = 'RECESS'; 
                cell.style.width = calcWidth; 
            } else {
                cell.className = 'time-slot'; 
                cell.style.width = calcWidth; 
                cell.ondragover = e => e.preventDefault(); 
                cell.ondrop = e => handleGenericDropFn(e, cls.name, p.id);
                
                const slotsForThisPeriod = state.rules ? state.rules.filter(r => r && r.class === cls.name && r.periodId === p.id) : [];
                if (slotsForThisPeriod.length === 0) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs pointer-events-none opacity-40';
                    placeholder.innerText = 'Empty Slot';
                    cell.appendChild(placeholder);
                } else {
                    slotsForThisPeriod.forEach(rule => {
                        const isClash = clashMap[rule.id]; 
                        const clashClass = isClash ? 'has-clash' : '';
                        
                        const col = document.createElement('div'); 
                        col.className = `vertical-col ${window.App._activeRuleId === rule.id ? 'active' : ''} ${clashClass}`;
                        
                        col.innerHTML = `<div class="drop-zone dz-sub ${rule.sub?'has-val':''}" data-action="clear-sub">${rule.sub ? rule.sub : '<span class="placeholder-text">+ SUB</span>'}</div>
                                         <div class="drop-zone dz-tea ${rule.tea?'has-val':''}" data-action="clear-tea">${rule.tea ? rule.tea : '<span class="placeholder-text">+ TEA</span>'}</div>
                                         <div class="drop-zone dz-day ${(rule.days||[]).some(d=>d)?'has-val':''}" data-action="toggle-day">(${getDayLabel(rule.days||[])})</div>`;
                                         
                        col.querySelector('[data-action="clear-sub"]').onclick = (e) => clearValueFn(e, rule.id, 'sub');
                        col.querySelector('[data-action="clear-sub"]').ondragover = (e) => e.preventDefault();
                        col.querySelector('[data-action="clear-sub"]').ondrop = (e) => handleTargetedDropFn(e, rule.id, 'sub');
                        
                        col.querySelector('[data-action="clear-tea"]').onclick = (e) => clearValueFn(e, rule.id, 'tea');
                        col.querySelector('[data-action="clear-tea"]').ondragover = (e) => e.preventDefault();
                        col.querySelector('[data-action="clear-tea"]').ondrop = (e) => handleTargetedDropFn(e, rule.id, 'tea');
                        
                        col.querySelector('[data-action="toggle-day"]').onclick = (e) => toggleStripFn(e, rule.id);
                        
                        if(window.App._activeRuleId === rule.id) {
                            col.appendChild(createDayStripFn(rule));
                        }
                        cell.appendChild(col);
                    });
                }
                const plus = document.createElement('div'); 
                plus.className = 'add-split'; 
                plus.innerText = '+'; 
                plus.ondrop = e => { e.stopPropagation(); handleGenericDropFn(e, cls.name, p.id); }; 
                plus.onclick = (e) => { e.stopPropagation(); handleGenericDropFn(e, cls.name, p.id); };
                cell.appendChild(plus);
            }
            row.appendChild(cell);
        });
    } 
    return row;
}