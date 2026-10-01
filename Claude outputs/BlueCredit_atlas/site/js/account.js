/* BlueCredit Atlas — sign in with the BlueCredit account (the same account as Marketplace).
 *
 * Sign-in, profile, plans and billing all live in the BlueCredit Account app
 * (marketplace.bluecredits.org/account). This file only:
 *   - sends people there to sign in and brings them back signed in (one-time code in the URL #fragment),
 *   - keeps their name and plan for this browser (entitlement token, refreshed from the API),
 *   - unlocks Pro features (reports, Pro layers, print) for Pro and Enterprise plans.
 * No passwords, card details or API tokens ever touch this site.
 *
 * SETUP: `api` = the BlueCredit backend, `account` = the Account app. Leave `api` empty to switch
 * sign-in off; then every feature is open to everyone.
 * Pages call window.dcwlRequirePro(fn, reason) / dcwlRequireAuth(fn, reason) and listen for the
 * 'dcwl:plan' event (names kept from the original map code).
 */
window.DCWL_ROOT = window.DCWL_ROOT || (document.currentScript && document.currentScript.src ? new URL('../', document.currentScript.src).href : '/');
window.BC_ACCOUNT = Object.assign({
    api: 'https://marketplace.bluecredits.org',            // BlueCredit backend (serves /api/v1/sso/*)
    account: 'https://marketplace.bluecredits.org/account', // BlueCredit Account app
    app: 'atlas',
    price: '$29/month or $290/year',                       // Pro price shown in the upgrade window
    logo: window.DCWL_ROOT + 'logo.png'
}, window.BC_ACCOUNT || {});

(function () {
    const C = window.BC_ACCOUNT;
    const API = (C.api || '').replace(/\/$/, ''), ACCT = (C.account || '').replace(/\/$/, '');
    const enabled = !!(API && ACCT);
    const KEY = 'bc_' + C.app + '_session', REFRESH_MS = 10 * 60 * 1000;
    let session = null;   // { entitlement, user: {email, first_name, last_name}, plan: {tier, tier_name, app_pro, ...}, at }
    let known = false, busy = null;

    const store = {
        get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
        set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} }
    };
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const here = () => location.href.split('#')[0];
    const signInUrl = () => `${ACCT}/connect?app=${encodeURIComponent(C.app)}&return=${encodeURIComponent(here())}`;
    const plansUrl = () => `${ACCT}/billing?from=${encodeURIComponent(C.app)}&return=${encodeURIComponent(here())}`;
    const isPro = () => !enabled || !!(session && session.plan && session.plan.app_pro);

    // ── styles ──
    const css = `
    #acct-chip { position: absolute; right: 24px; top: 22px; z-index: 1001; display: flex; align-items: center; gap: 9px;
        background: #1e6fd9; border: 0; border-radius: 10px; box-shadow: 0 4px 14px rgba(30,111,217,.35); padding: 11px 20px;
        font: 700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #fff; cursor: pointer; }
    #acct-chip:hover { background: #1557b0; }
    #acct-chip.in { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; box-shadow: 0 2px 10px rgba(0,0,0,.15); padding: 6px 14px 6px 6px; }
    #acct-chip.in:hover { border-color: #1e6fd9; }
    #acct-chip svg { width: 18px; height: 18px; flex: none; }
    #acct-chip .av { width: 32px; height: 32px; border-radius: 50%; background: #0b7dda; color: #fff; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
    #acct-chip .em { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 14px; }
    #acct-menu { position: absolute; top: 74px; right: 24px; z-index: 1002; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15,23,42,.18); padding: 16px; width: 280px; display: none;
        font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #334155; }
    #acct-menu.open { display: block; }
    #acct-menu .who { text-align: center; padding-bottom: 12px; border-bottom: 1px solid #eef2f6; margin-bottom: 10px; }
    #acct-menu .who .av { width: 52px; height: 52px; border-radius: 50%; background: #0b7dda; color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 700; margin: 0 auto 6px; }
    #acct-menu .who b { color: #0f172a; display: block; font-size: 15px; } #acct-menu .who span { color: #64748b; word-break: break-all; }
    #acct-menu .plan { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
    #acct-menu a.it, #acct-menu button.it { display: block; width: 100%; text-align: left; padding: 9px 10px; border-radius: 8px; border: 0; background: none; color: #0f172a;
        font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; text-decoration: none; cursor: pointer; }
    #acct-menu a.it:hover, #acct-menu button.it:hover { background: #f1f5f9; }
    #acct-menu .fine { font-size: 11px; color: #94a3b8; margin-top: 8px; text-align: center; }
    @media (max-width: 700px) { #acct-chip { right: 70px; top: 16px; padding: 9px 14px; font-size: 14px; } #acct-chip.in .em { display: none; } #acct-chip.in { padding: 5px; }
        #acct-menu { right: 16px; top: 68px; } }
    .acct-pro { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .06em; background: #f59e0b; color: #fff; border-radius: 999px; padding: 1px 7px; }
    .acct-free { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .06em; background: #e2e8f0; color: #334155; border-radius: 999px; padding: 1px 7px; }
    #acct-modal { position: fixed; inset: 0; z-index: 5000; background: rgba(15,23,42,.55); display: none; align-items: center; justify-content: center; padding: 16px; }
    #acct-modal.open { display: flex; }
    #acct-card { position: relative; background: #fff; width: 100%; max-width: 430px; max-height: 94vh; overflow: auto; border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,.35);
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #334155; }
    #acct-card .top { background: linear-gradient(135deg, #0b3a82, #1e6fd9); padding: 18px 24px 16px; color: #fff; text-align: center; }
    #acct-card .top img { height: 30px; width: auto; background: #fff; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; }
    #acct-card h3 { margin: 0; font-size: 19px; } #acct-card .top p { margin: 6px 0 0; font-size: 13px; opacity: .92; }
    #acct-card .bd { padding: 18px 24px 22px; }
    #acct-card ul { margin: 0 0 14px; padding-left: 18px; font-size: 13.5px; } #acct-card li { margin: 3px 0; }
    #acct-card .go { display: block; width: 100%; box-sizing: border-box; text-align: center; padding: 12px; border: 0; border-radius: 10px; background: #1e6fd9; color: #fff;
        font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }
    #acct-card .go:hover { background: #1557b0; }
    #acct-card .sec { display: block; width: 100%; margin-top: 8px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; font-weight: 600; cursor: pointer; font-size: 14px; }
    #acct-card .fine { font-size: 11.5px; color: #64748b; margin-top: 12px; text-align: center; } #acct-card .fine a { color: inherit; }
    #acct-card .x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #fff; font-size: 24px; line-height: 1; cursor: pointer; opacity: .85; }
    #acct-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 5001; background: #0f172a; color: #fff; padding: 11px 18px;
        border-radius: 10px; font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.3); display: none; }
    #acct-toast.on { display: block; }`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
    const titleFor = r => r === 'print_map' ? 'Print-ready maps are part of Pro' : /_report$/.test(r || '') ? 'Water reports are part of Pro'
        : /^layer_/.test(r || '') ? 'This map layer is part of Pro' : 'Upgrade to Pro';
    const PRO_LIST = `<ul>
        <li>Site, location, basin, utility and Loudoun water reports (PDF + CSV)</li>
        <li>Pro map layers: live streamgages, groundwater wells, 2035 projected data centers, wastewater plants, reclaimed and recycled water</li>
        <li>Print-ready maps with your chosen layers</li>
        <li>Also in Marketplace: up to 10 sites, AI water-bill upload and site analytics</li></ul>`;

    let chip, menu, modal, toastEl, pendingFn = null;
    const $ = id => document.getElementById(id);
    const initials = u => ((u && ((u.first_name || '')[0] || '') + ((u.last_name || '')[0] || '')) || (u && (u.email || '')[0]) || '?').toUpperCase();

    function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('on'), 3200); }

    function buildUI() {
        chip = document.createElement('button'); chip.id = 'acct-chip'; chip.type = 'button';
        menu = document.createElement('div'); menu.id = 'acct-menu';
        modal = document.createElement('div'); modal.id = 'acct-modal';
        toastEl = document.createElement('div'); toastEl.id = 'acct-toast';
        document.body.append(chip, menu, modal, toastEl);
        document.body.classList.add('acct-tr');
        chip.addEventListener('click', e => { e.stopPropagation(); const l = document.getElementById('bc-apps'); if (l) l.classList.remove('open'); if (!session) { location.href = signInUrl(); return; } menu.classList.toggle('open'); });
        document.addEventListener('click', e => { if (!menu.contains(e.target) && e.target !== chip) menu.classList.remove('open'); });
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); menu.classList.remove('open'); } });
        ['mousedown', 'dblclick', 'wheel', 'contextmenu'].forEach(t => [chip, menu].forEach(el => el.addEventListener(t, e => e.stopPropagation())));
    }

    function render() {
        if (!chip) return;
        if (!enabled) { chip.style.display = 'none'; menu.style.display = 'none'; }
        else if (!session) {
            chip.className = ''; chip.innerHTML = ICON_USER + 'Sign in'; chip.title = 'Sign in with your BlueCredit account';
            menu.classList.remove('open');
        } else {
            const u = session.user || {}, p = session.plan || {};
            chip.className = 'in'; chip.title = 'BlueCredit account';
            chip.innerHTML = `<span class="av">${esc(initials(u))}</span><span class="em">${esc(u.first_name || u.email)}</span>${p.app_pro ? '<span class="acct-pro">PRO</span>' : ''}`;
            const end = p.current_period_end ? new Date(p.current_period_end.endsWith('Z') ? p.current_period_end : p.current_period_end + 'Z') : null;
            menu.innerHTML = `<div class="who"><div class="av">${esc(initials(u))}</div><b>${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || 'BlueCredit user')}</b><span>${esc(u.email)}</span></div>
                <div class="plan"><span>Plan: <b style="display:inline">${esc(p.tier_name || 'Free')}</b>${end && !isNaN(end) ? `<br><span style="color:#64748b;font-size:11.5px">${p.cancel_at_period_end ? 'ends' : 'renews'} ${end.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>` : ''}</span>${p.app_pro ? '<span class="acct-pro">PRO</span>' : '<span class="acct-free">FREE</span>'}</div>
                <a class="it" href="${ACCT}">Manage your BlueCredit account</a>
                <a class="it" href="${plansUrl()}">${p.app_pro ? 'Plans &amp; billing' : 'Upgrade to Pro'}</a>
                <button class="it" type="button" id="acct-refresh">Refresh my plan</button>
                <button class="it" type="button" id="acct-out" style="color:#b91c1c">Sign out of Atlas</button>
                <div class="fine">One account for Marketplace, Atlas and every BlueCredit app</div>`;
            $('acct-out').onclick = signOut;
            $('acct-refresh').onclick = () => refresh(true).then(() => toast(isPro() ? 'Pro is active' : 'Plan updated'));
        }
        document.body.classList.toggle('dcwl-pro', isPro() && enabled);
        window.dispatchEvent(new CustomEvent('dcwl:plan', { detail: { pro: isPro(), signedIn: !!session, known: !enabled || known } }));
    }

    function openModal(html) { modal.innerHTML = `<div id="acct-card" role="dialog" aria-modal="true">${html}</div>`; modal.classList.add('open');
        const x = modal.querySelector('.x'); if (x) x.onclick = closeModal; }
    function closeModal() { if (modal) modal.classList.remove('open'); }
    const top = (h, p) => `<button class="x" type="button" aria-label="Close">×</button><div class="top"><img src="${esc(C.logo)}" alt="BlueCredit" onerror="this.remove()"><h3>${h}</h3><p>${p}</p></div>`;

    function showSignIn(reason, pro) {
        openModal(top(pro ? titleFor(reason) : 'Sign in to continue',
            'Use your BlueCredit account — the same one as the Marketplace')
            + `<div class="bd">${pro ? PRO_LIST : ''}
                <a class="go" href="${signInUrl()}">Sign in with BlueCredit</a>
                <a class="sec" style="text-align:center;text-decoration:none;box-sizing:border-box" href="${ACCT.replace(/\/account$/, '')}/register">Create a free account</a>
                <div class="fine">Free accounts get the full map and free layers. Pro is ${esc(C.price)}. <a href="${window.DCWL_ROOT}pages/terms.html" target="_blank" rel="noopener">Terms</a></div></div>`);
    }

    function showUpgrade(reason) {
        openModal(top(titleFor(reason), `Pro · ${esc(C.price)} · cancel anytime`)
            + `<div class="bd">${PRO_LIST}
                <a class="go" href="${plansUrl()}">See plans and upgrade</a>
                <button class="sec" type="button" id="acct-recheck">I've upgraded — check again</button>
                <div class="fine">Billing is handled in your BlueCredit account. <a href="${window.DCWL_ROOT}pages/terms.html" target="_blank" rel="noopener">Terms &amp; Refund Policy</a></div></div>`);
        $('acct-recheck').onclick = () => refresh(true).then(() => {
            if (isPro()) { closeModal(); toast('Pro is active — thank you'); const f = pendingFn; pendingFn = null; if (f) setTimeout(f, 150); }
            else toast('Your plan is still Free. It can take a minute after payment.');
        });
    }

    // ── API ──
    async function post(path, body) {
        const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let j = null; try { j = await r.json(); } catch (e) {}
        if (!r.ok) { const err = new Error((j && j.description) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
        return (j && j.payload) || j;
    }
    function keep(p) { session = { entitlement: p.entitlement, user: p.user || {}, plan: p.plan || {}, at: Date.now() }; store.set(session); known = true; render(); }
    function signOut() { session = null; store.set(null); known = true; menu.classList.remove('open'); render(); toast('Signed out of Atlas'); }
    function refresh(force) {
        if (!session) { known = true; render(); return Promise.resolve(); }
        if (!force && Date.now() - (session.at || 0) < REFRESH_MS) { known = true; render(); return Promise.resolve(); }
        if (busy) return busy;
        busy = post('/api/v1/sso/session', { entitlement: session.entitlement }).then(keep)
            .catch(e => { if (e.status === 401) { session = null; store.set(null); } known = true; render(); })
            .finally(() => { busy = null; });
        return busy;
    }
    function start() {
        if (!enabled) { known = true; render(); console.warn('[BlueCredit atlas] Sign-in not configured (BC_ACCOUNT.api empty): all features open.'); return Promise.resolve(); }
        const m = location.hash.match(/[#&]bc_code=([^&]+)/);
        if (m) {
            const clean = location.hash.replace(/[#&]?bc_code=[^&]+/, '').replace(/^#?&/, '#');
            history.replaceState(null, '', location.pathname + location.search + (clean && clean !== '#' ? clean : ''));
            return post('/api/v1/sso/exchange', { code: decodeURIComponent(m[1]), app: C.app })
                .then(p => { keep(p); toast(`Signed in as ${(p.user && (p.user.first_name || p.user.email)) || 'you'}${p.plan && p.plan.app_pro ? ' · Pro' : ''}`); })
                .catch(e => { known = true; render(); toast(e.message || 'Sign-in failed. Please try again.'); });
        }
        session = store.get();
        return refresh(false);
    }

    // ── public API used by the map ──
    window.dcwlRequirePro = async function (fn, reason) {
        if (!enabled) return fn();
        if (busy) await busy;
        if (isPro()) return fn();
        pendingFn = fn;
        return session ? showUpgrade(reason) : showSignIn(reason, true);
    };
    window.dcwlRequireAuth = async function (fn, reason) {
        if (!enabled || session) return fn();
        pendingFn = fn; showSignIn(reason, false);
    };
    window.dcwlIsPro = () => isPro();
    window.dcwlUser = () => session && session.user;
    window.dcwlLogReport = function () { /* report activity is not logged on Atlas */ };

    const go = () => { buildUI(); render(); start(); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
