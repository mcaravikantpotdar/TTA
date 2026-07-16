import { state } from '../state.js';

// DOM HELPER SANITIZER
const cleanText = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str.trim();
    return temp.innerHTML;
};

// COMPUTE LIVE WORKLOAD MATRICES
export function calculateWorkload() { 
    let c = { sub: {}, tea: {} }; 
    if (!state.rules) return c; 
    state.rules.forEach(r => { 
        if (!r) return; 
        const n = (r.days || []).filter(d => d).length; 
        if (r.sub) c.sub[r.sub] = (c.sub[r.sub] || 0) + n; 
        if (r.tea) c.tea[r.tea] = (c.tea[r.tea] || 0) + n; 
    }); 
    return c; 
}

// SIDEBAR DOM GENERATION LOOP
export function renderSidebar(openRegModalFn, deleteRegistryFn, showNameTooltipFn, hideTooltipFn) {
    const workload = calculateWorkload();
    const sPool = document.getElementById('subPool');
    const tPool = document.getElementById('teaPool');
    
    sPool.innerHTML = ''; 
    tPool.innerHTML = '';
    
    state.registry.subjects.forEach((v, i) => {
        sPool.appendChild(createSidePill('sub', v, i, workload.sub[v.s] || 0, openRegModalFn, deleteRegistryFn, showNameTooltipFn, hideTooltipFn));
    });
    
    state.registry.teachers.forEach((v, i) => {
        tPool.appendChild(createSidePill('tea', v, i, workload.tea[v.s] || 0, openRegModalFn, deleteRegistryFn, showNameTooltipFn, hideTooltipFn));
    });
}

function createSidePill(type, item, idx, count, openRegModalFn, deleteRegistryFn, showNameTooltipFn, hideTooltipFn) {
    const d = document.createElement('div'); 
    d.className = 'pill'; 
    d.draggable = true;
    
    const cleanShort = cleanText(item.s);
    const cleanDesig = item.d ? cleanText(item.d) : '';
    const desigHtml = cleanDesig ? `<span class="text-[8px] font-normal opacity-50 block leading-tight truncate w-20">${cleanDesig}</span>` : '';
    
    d.innerHTML = `<div><span>${cleanShort}</span>${desigHtml}</div>
                   <div class="flex gap-2 items-center">
                       <span class="pill-count">${count}</span>
                       <i class="icon-btn text-indigo-600 hover:text-indigo-900" data-action="edit">✎</i>
                       <i class="icon-btn text-rose-600 hover:text-rose-900" data-action="delete">🗑</i>
                   </div>`;
                   
    // Safe module-level scope event interceptors
    d.ondragstart = () => { window.App._dragged = { type, val: item.s }; };
    d.onmouseover = (e) => showNameTooltipFn(e, item.s, type);
    d.onmouseleave = hideTooltipFn;
    
    d.querySelector('[data-action="edit"]').onclick = () => openRegModalFn(type, idx);
    d.querySelector('[data-action="delete"]').onclick = (e) => deleteRegistryFn(e, type, idx);
    
    return d;
}