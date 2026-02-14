/* storage.js
   Single source of truth for app state stored in LocalStorage.
   Data model is versioned to allow safe upgrades.
*/

(function(){
  'use strict';

  const STORAGE_KEY = 'CBT_FMS_V1';
  const SESSION_KEY = 'CBT_FMS_SESSION_V1';

  const DEFAULTS = {
    version: 1,
    settings: {
      currency: 'UGX',
      currencyLocale: 'en-UG',
      darkMode: false,
      idleLogoutMinutes: 10,
      financialYearStartMonth: 1, // 1=Jan
      openingCash: 0,
      openingBank: 0
    },
    categories: {
      income: [
        'Tithe','Offering','Thanksgiving','Seed','Building Fund','Welfare','Special Contribution'
      ],
      expense: [
        'Utilities','Rent','Sound & Media','Welfare','Pastoral Support','Maintenance','Events','Transport','Miscellaneous'
      ]
    },
    users: [
      // passwordHash set on first init using auth.js
      { username: 'admin', role: 'admin', passwordHash: null, createdAt: null, updatedAt: null }
    ],
    incomes: [],
    expenses: [],
    payouts: [],
    transfers: [], // { id, date, type:'deposit'|'withdrawal', amount, notes, recordedBy }
    budgets: {
      // monthKey: { "Utilities": 100, ... }
    },
    audit: []
  };

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function safeParse(json, fallback){
    try{
      const parsed = JSON.parse(json);
      return parsed ?? fallback;
    }catch{
      return fallback;
    }
  }

  function getState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return deepClone(DEFAULTS);

    const parsed = safeParse(raw, null);
    if(!parsed || typeof parsed !== 'object') return deepClone(DEFAULTS);

    // Lightweight migration/merge for missing keys
    const merged = deepClone(DEFAULTS);
    mergeInto(merged, parsed);
    merged.version = 1;

    // Migrate old default currency (GHS) to new default (UGX).
    // Do not override if user already changed it to something else.
    if(
      merged.settings &&
      merged.settings.currency === 'GHS' &&
      merged.settings.currencyLocale === 'en-GH'
    ){
      merged.settings.currency = 'UGX';
      merged.settings.currencyLocale = 'en-UG';
    }
    return merged;
  }

  function mergeInto(target, source){
    for(const [k,v] of Object.entries(source)){
      if(v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])){
        mergeInto(target[k], v);
      }else{
        target[k] = v;
      }
    }
  }

  function saveState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function update(mutator){
    const state = getState();
    const next = mutator(deepClone(state)) || state;
    saveState(next);
    return next;
  }

  function getSession(){
    const raw = localStorage.getItem(SESSION_KEY);
    return safeParse(raw, null);
  }

  function setSession(session){
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession(){
    localStorage.removeItem(SESSION_KEY);
  }

  function exportAll(){
    const state = getState();
    return {
      exportedAt: new Date().toISOString(),
      app: 'CBT_FMS',
      version: state.version,
      payload: state
    };
  }

  function importAll(backupObject){
    if(!backupObject || typeof backupObject !== 'object') throw new Error('Invalid backup file.');
    const payload = backupObject.payload;
    if(!payload || typeof payload !== 'object') throw new Error('Invalid backup payload.');
    // Merge with defaults to ensure required keys exist
    const merged = deepClone(DEFAULTS);
    mergeInto(merged, payload);
    merged.version = 1;
    saveState(merged);
    return merged;
  }

  function clearAll(){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function pushAudit(action, details, actor){
    update((state)=>{
      state.audit = state.audit || [];
      state.audit.unshift({
        id: makeId('AUD'),
        at: new Date().toISOString(),
        action,
        details: details || {},
        actor: actor || 'unknown'
      });
      state.audit = state.audit.slice(0, 1000);
      return state;
    });
  }

  function makeId(prefix){
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.random().toString(16).slice(2,8).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
  }

  window.CBTStorage = {
    STORAGE_KEY,
    SESSION_KEY,
    DEFAULTS,
    getState,
    saveState,
    update,
    getSession,
    setSession,
    clearSession,
    exportAll,
    importAll,
    clearAll,
    pushAudit,
    makeId
  };
})();
