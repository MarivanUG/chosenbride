/* auth.js
   Simple LocalStorage-based authentication for a static app.
   - Default admin: admin / admin123 (hashed in storage)
   - Auto logout after inactivity
*/

(function(){
  'use strict';

  const SESSION_TTL_KEY = 'idleLogoutMinutes';

  async function sha256Hex(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function nowMs(){
    return Date.now();
  }

  function getIdleTimeoutMs(){
    const state = CBTStorage.getState();
    const mins = Number(state.settings?.idleLogoutMinutes ?? 10);
    return Math.max(1, mins) * 60 * 1000;
  }

  function isSessionValid(session){
    if(!session || typeof session !== 'object') return false;
    if(!session.username || !session.token || !session.lastActive) return false;
    const idleMs = getIdleTimeoutMs();
    return (nowMs() - Number(session.lastActive)) <= idleMs;
  }

  function touchSession(){
    const session = CBTStorage.getSession();
    if(!session) return;
    session.lastActive = nowMs();
    CBTStorage.setSession(session);
  }

  function logout(){
    CBTStorage.clearSession();
  }

  function getCurrentUser(){
    const session = CBTStorage.getSession();
    if(!isSessionValid(session)) return null;

    const state = CBTStorage.getState();
    return state.users.find(u=>u.username === session.username) || null;
  }

  async function ensureDefaultAdmin(){
    // Make sure admin exists and has password hash.
    const state = CBTStorage.getState();
    const admin = (state.users || []).find(u=>u.username === 'admin');

    if(!admin){
      CBTStorage.update((s)=>{
        s.users = s.users || [];
        s.users.push({ username: 'admin', role: 'admin', passwordHash: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return s;
      });
      return ensureDefaultAdmin();
    }

    if(!admin.passwordHash){
      const hash = await sha256Hex('admin123');
      CBTStorage.update((s)=>{
        const a = s.users.find(u=>u.username === 'admin');
        a.passwordHash = hash;
        a.createdAt = a.createdAt || new Date().toISOString();
        a.updatedAt = new Date().toISOString();
        return s;
      });
    }
  }

  async function login(username, password){
    await ensureDefaultAdmin();

    const state = CBTStorage.getState();
    const user = (state.users || []).find(u=>u.username === username);
    if(!user) throw new Error('Invalid username or password.');

    const hash = await sha256Hex(password);
    if(user.passwordHash !== hash) throw new Error('Invalid username or password.');

    const token = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(16).slice(2) + '-' + nowMs());
    CBTStorage.setSession({ username: user.username, token, lastActive: nowMs() });
    CBTStorage.pushAudit('login', {}, user.username);
    return user;
  }

  async function changePassword(username, oldPassword, newPassword){
    const state = CBTStorage.getState();
    const user = (state.users || []).find(u=>u.username === username);
    if(!user) throw new Error('User not found.');

    const oldHash = await sha256Hex(oldPassword);
    if(user.passwordHash !== oldHash) throw new Error('Current password is incorrect.');

    const newHash = await sha256Hex(newPassword);
    CBTStorage.update((s)=>{
      const u = s.users.find(x=>x.username === username);
      u.passwordHash = newHash;
      u.updatedAt = new Date().toISOString();
      return s;
    });

    CBTStorage.pushAudit('password_change', {}, username);
  }

  function requireAuth(){
    const session = CBTStorage.getSession();
    if(!isSessionValid(session)){
      logout();
      window.location.replace('login.html');
      return null;
    }

    // Keep session alive
    touchSession();
    const user = getCurrentUser();
    if(!user){
      logout();
      window.location.replace('login.html');
      return null;
    }
    return user;
  }

  function startActivityWatch(){
    const events = ['click','keydown','mousemove','touchstart','scroll'];
    let lastTouch = 0;

    const handler = ()=>{
      const now = nowMs();
      // throttle frequent events
      if(now - lastTouch < 1500) return;
      lastTouch = now;
      touchSession();
    };

    events.forEach(ev=>window.addEventListener(ev, handler, { passive: true }));

    // Timer to enforce auto-logout
    setInterval(()=>{
      const s = CBTStorage.getSession();
      if(!s) return;
      if(!isSessionValid(s)){
        logout();
        window.location.replace('login.html');
      }
    }, 15_000);
  }

  window.CBTAuth = {
    sha256Hex,
    ensureDefaultAdmin,
    login,
    logout,
    requireAuth,
    getCurrentUser,
    changePassword,
    startActivityWatch
  };
})();
