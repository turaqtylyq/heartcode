/* HEARTCODE anonymous device-level usage tracking for the owner-only spreadsheet.
 * Requires an explicitly checked entry consent and a configured Apps Script URL.
 * No full phone number, browser fingerprint, IP address or password is collected here.
 */
(function () {
  'use strict';
  var ENDPOINT = (window.HEARTCODE_ANALYTICS_URL || '').trim();
  var active = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(ENDPOINT);
  var entryStorage = 'heartcode_v13_entry';
  var visitorKey = 'hc_visitor_id_v1';
  var sessionKey = 'hc_analytics_session_v1';
  var sentVisitKey = 'hc_analytics_visit_sent_v1';
  var lessonRoutes = new Set(['lesson-1', 'lesson-2', 'm2-lesson-1', 'm2-lesson-2',
    'm2-lesson-3', 'bonus-lesson-1', 'module-3', 'module-4']);
  var currentRoute = '';
  var startedAt = null;
  var lastRouteEvent = '';
  var navigating = false;
  function stored(key, value, scope) {
    try {
      var storage = scope === 'session' ? sessionStorage : localStorage;
      if (value !== undefined) storage.setItem(key, value);
      return storage.getItem(key);
    } catch (_) { return null; }
  }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'hc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function getId(key, scope) {
    var value = stored(key, undefined, scope);
    if (!value || !/^[A-Za-z0-9_-]{10,70}$/.test(value)) {
      value = uuid();
      stored(key, value, scope);
    }
    return value;
  }
  function savedEntry() {
    try { return JSON.parse(localStorage.getItem(entryStorage) || 'null'); }
    catch (_) { return null; }
  }
  function allowed() {
    var saved = savedEntry();
    return !!(saved && saved.analyticsConsent === true && typeof saved.name === 'string');
  }
  function normalizeRole(value) {
    var role = String(value || '');
    if (role === 'Дәрігер' || role === 'Врач') return 'Врач';
    if (role === 'Фельдшер') return 'Фельдшер';
    if (role === 'Медбрат / Медсестра' || role === 'Медбрат / медсестра') return 'Медбрат / медсестра';
    if (role === 'Резидент / Интерн' || role === 'Резидент / интерн') return 'Резидент / интерн';
    return 'Другое';
  }
  function sourceName() {
    var previous = stored('hc_analytics_source_v1', undefined, 'session');
    if (previous) return previous;
    var q = new URLSearchParams(location.search);
    var src = (q.get('utm_source') || '').toLowerCase();
    var medium = (q.get('utm_medium') || '').toLowerCase();
    var ref = (document.referrer || '').toLowerCase();
    var source = 'Не определён';
    if (src.includes('whatsapp') || ref.includes('whatsapp')) source = 'WhatsApp';
    else if (q.has('fbclid') || medium.includes('paid') || medium.includes('cpc') || src.includes('facebook_ads') || src.includes('meta_ads')) source = 'Meta Ads';
    else if (src.includes('instagram') || ref.includes('instagram.com') || ref.includes('l.instagram.com')) source = 'Instagram';
    else if (src.includes('direct')) source = 'Прямой';
    else if (src || ref) source = 'Другое';
    else source = 'Прямой';
    stored('hc_analytics_source_v1', source, 'session');
    return source;
  }
  function deviceName() { return /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent || '') ? 'Телефон' : 'Компьютер'; }
  function routeName() { return (location.hash || '#home').slice(1).slice(0,70) || 'home'; }
  function emit(data) {
    if (!active) return false;
    var payload = Object.assign({
      visitorId: getId(visitorKey, 'local'),
      sessionId: getId(sessionKey, 'session'),
      source: sourceName(),
      device: deviceName(),
      page: routeName(),
      consent: true
    }, data);
    var body = new URLSearchParams({payload: JSON.stringify(payload)});
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return true;
    } catch (_) {}
    try {
      fetch(ENDPOINT, {method: 'POST', mode: 'no-cors',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString(), keepalive: true}).catch(function () {});
      return true;
    } catch (_) { return false; }
  }
  function recordVisit(name, role, last4, other) {
    if (!active) return;
    if (stored(sentVisitKey, undefined, 'session') === 'yes') return;
    var safeRole = normalizeRole(role);
    if (emit({kind:'visit', name:String(name || '').slice(0,70),
      role:safeRole, other:safeRole === 'Другое' ? String(other || role || '').slice(0,60) : '',
      last4: /^\d{4}$/.test(last4 || '') ? last4 : '', event:'login'})) {
      stored(sentVisitKey, 'yes', 'session');
    }
  }
  function event(type, route, secs) {
    if (!active || !allowed()) return;
    emit({kind:'event', event:type, page:(route || routeName()).slice(0,70),
      lesson: lessonRoutes.has(route) ? route : '', seconds:Math.max(0,Math.min(21600,Number(secs) || 0))});
  }
  function changeRoute(next) {
    if (!active || !allowed()) return;
    next = next || routeName();
    if (next === currentRoute && lastRouteEvent === next) return;
    if (startedAt !== null && lessonRoutes.has(currentRoute)) {
      event('lesson_close', currentRoute, Math.round((Date.now() - startedAt) / 1000));
    }
    currentRoute = next;
    startedAt = lessonRoutes.has(next) ? Date.now() : null;
    lastRouteEvent = next;
    event(lessonRoutes.has(next) ? 'lesson_open' : 'page_view', next);
  }
  window.HeartcodeAnalytics = {
    onEntry: function (info) {
      if (!info || !info.consent) return;
      recordVisit(info.name, info.role, info.last4, info.other);
      // The entry form will save analyticsConsent before unlocking the page.
      setTimeout(function () { changeRoute('home'); }, 0);
    }
  };
  if (active) {
    var note = document.querySelector('.hc-entry-privacy');
    if (note) note.textContent = 'ⓘ Сіздің келісіміңізден кейін атыңыз, мамандығыңыз, WhatsApp соңғы 4 цифры және курс әрекеттері HEARTCODE әкімшісінің жабық Google кестесіне жазылады. Толық нөмір алынбайды.';
  }
  if (active && allowed()) {
    var saved = savedEntry();
    recordVisit(saved.name, saved.role, '', saved.role);
    changeRoute(routeName());
  }
  document.addEventListener('click', function (e) {
    if (!active || !allowed()) return;
    var el = e.target && e.target.closest ? e.target.closest('a,button') : null;
    if (!el) return;
    var label = (el.textContent || '').trim().toLowerCase();
    var href = (el.getAttribute('href') || '').toLowerCase();
    if (/сатып ал|купить|оплат|төлеу|purchase/.test(label) || el.dataset.analytics === 'purchase') {
      event('purchase_click', routeName());
    } else if (href.includes('wa.me/') || href.includes('whatsapp.com/') || href.includes('t.me/') || href.startsWith('tel:') || href.startsWith('mailto:') || el.dataset.analytics === 'contact') {
      event('contact_click', routeName());
    }
    if (href.charAt(0) === '#') {
      setTimeout(function () { changeRoute(routeName()); }, 0);
    }
  });
  window.addEventListener('hashchange', function () { changeRoute(routeName()); });
  window.addEventListener('popstate', function () { changeRoute(routeName()); });
  window.addEventListener('pagehide', function () {
    if (active && allowed() && startedAt !== null && lessonRoutes.has(currentRoute)) {
      event('lesson_close', currentRoute, Math.round((Date.now() - startedAt) / 1000));
    }
  });
})();
