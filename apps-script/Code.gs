/**
 * HEARTCODE → private Google Sheet
 * Install from the Google Sheet: Extensions → Apps Script → replace Code.gs.
 * Deploy → New deployment → Web app → Execute as: Me; Who has access: Anyone.
 *
 * Important: a public web endpoint cannot authenticate a static GitHub Pages
 * visitor. Keep the spreadsheet itself private; never add its ID/password to
 * index.html or analytics-config.js. Rate limits here are best-effort only.
 */
const HC = Object.freeze({
  visits: 'Посещения',
  people: 'Посетители',
  activity: 'Активность',
  sourceOptions: ['Instagram', 'Meta Ads', 'WhatsApp', 'Прямой', 'Другое', 'Не определён'],
  roles: ['Врач', 'Фельдшер', 'Медбрат / медсестра', 'Резидент / интерн', 'Другое'],
  events: ['login', 'page_view', 'lesson_open', 'lesson_close', 'purchase_click', 'contact_click']
});

function doGet() {
  return ContentService.createTextOutput('HEARTCODE analytics collector is ready. No user data is available here.');
}

function doPost(e) {
  try {
    const raw = (e && e.parameter && e.parameter.payload) || '';
    if (!raw || raw.length > 6000) return respond_('invalid');
    const p = JSON.parse(raw);
    if (!p || p.consent !== true || !['visit', 'event'].includes(p.kind)) return respond_('invalid');

    const visitorId = id_(p.visitorId);
    const sessionId = id_(p.sessionId);
    if (visitorId.length < 10 || sessionId.length < 10) return respond_('invalid');

    const cache = CacheService.getScriptCache();
    const limiter = 'hc-limit-' + visitorId;
    const hits = Number(cache.get(limiter) || '0');
    if (hits > 120) return respond_('limited');
    cache.put(limiter, String(hits + 1), 900);

    const now = new Date();
    const source = HC.sourceOptions.includes(p.source) ? p.source : 'Не определён';
    const device = p.device === 'Телефон' ? 'Телефон' : 'Компьютер';
    const page = text_(p.page, 70) || 'home';

    const lock = LockService.getScriptLock();
    lock.waitLock(8000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) return respond_('setup_required');
      const people = ss.getSheetByName(HC.people);
      const visits = ss.getSheetByName(HC.visits);
      const activity = ss.getSheetByName(HC.activity);
      if (!people || !visits || !activity) return respond_('tabs_missing');

      if (p.kind === 'visit') {
        const name = text_(p.name, 70);
        if (name.length < 2) return respond_('invalid_name');
        const role = HC.roles.includes(p.role) ? p.role : 'Другое';
        const other = role === 'Другое' ? text_(p.other, 60) : '';
        const last4 = /^\d{4}$/.test(String(p.last4 || '')) ? String(p.last4) : '';
        const prior = findVisitor_(people, visitorId);
        if (prior > 0) {
          people.getRange(prior, 2, 1, 4).setValues([[name, last4 || people.getRange(prior, 3).getDisplayValue(), role, other]]);
          people.getRange(prior, 7, 1, 4).setValues([[now, source, device, 'Да']]);
        } else {
          people.appendRow([visitorId, name, last4, role, other, now, now, source, device, 'Да']);
        }
        visits.appendRow([now, name, last4, role, other, page, 'login', 'Да', visitorId, source, device, sessionId]);
        return respond_('ok');
      }

      // Activity events must correspond to a visitor who already completed
      // the explicit consent gate. No other spreadsheet data can be read.
      if (findVisitor_(people, visitorId) === 0) return respond_('unknown_visitor');
      const event = HC.events.includes(p.event) ? p.event : '';
      if (!event || event === 'login') return respond_('invalid_event');
      const lesson = text_(p.lesson, 80);
      const seconds = Math.max(0, Math.min(21600, Math.round(Number(p.seconds) || 0)));
      activity.appendRow([now, visitorId, event, page, lesson, seconds, source, device, sessionId]);
      return respond_('ok');
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // No personal data or stack traces in any public response.
    console.error('HEARTCODE ingestion failed: ' + (err && err.message ? err.message : 'unknown'));
    return respond_('error');
  }
}

function findVisitor_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const result = sheet.getRange(2, 1, last - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return result ? result.getRow() : 0;
}

function id_(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 70);
}

function text_(value, limit) {
  let s = String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function respond_(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}
