/* HEARTCODE — first-lesson public preview (UI restrictions only).
 * The full course is still public at ../index.html: this is NOT access control.
 * Moving protected lessons and assets behind authenticated storage is required
 * before treating paid materials as genuinely private.
 */
(function () {
  'use strict';

  const course = document.getElementById('course');
  const modal = document.getElementById('previewLock');
  const modalTitle = document.getElementById('previewLockTitle');
  const modalText = document.getElementById('previewLockText');
  const understood = document.getElementById('previewOkay');
  let contentWin = null;
  let contentDoc = null;
  let activeObserver = null;
  let repaintQueued = false;
  let redirecting = false;

  const lockedTitle = 'Толық қолжетімділік қажет';
  const messages = {
    content: 'Бұл материал танысу нұсқасында ашылмайды. Толық курсқа төлем жасағаннан кейін барлық бейнесабақтар, конспекттер мен тапсырмалар қолжетімді болады.',
    chat: 'Курс чатына қосылу толық курсқа төлем жасағаннан кейін қолжетімді болады.',
    lesson: 'Бұл бейнесабақ толық курсқа төлем жасағаннан кейін ашылады. Танысу үшін 1-модульдің 1-сабағын көре аласыз.'
  };

  const norm = value => String(value == null ? '' : value).trim().toLowerCase();
  const hash = value => norm(value).replace(/^.*#/, '').replace(/^#/, '');
  const modulePage = route => /^module[-_ ]?[1-9]\d*$/.test(hash(route));
  const freeResources = new Set(['lesson-1', 'notes-1', 'note-1', 'test-1', 'quiz-1', 'task-1', 'assignment-1', 'practice-1']);
  function paidRoute(value) {
    const route = hash(value);
    if (!route || freeResources.has(route) || modulePage(route)) return false;
    if (/^(?:m[2-9]\d*[-_]?lesson(?:[-_]\d+)?|module[-_]?[2-9]\d*[-_](?:lesson|notes?|tests?|quizzes?|tasks?|assignments?|practices?|videos?)(?:[-_]\d+)?|bonus[-_]lesson(?:[-_]\d+)?|lesson[-_]\d+|notes?[-_]\d+|tests?[-_]\d+|quizzes?[-_]\d+|task[-_]\d+|assignment[-_]\d+|practice[-_]\d+)(?:$|[-_])/.test(route)) return true;
    if (/^(?:treatment|bonus-lesson|paid-content|video-lesson)/.test(route)) return true;
    return false;
  }

  function titleText(element) {
    return norm(element && (element.innerText || element.textContent || '')).replace(/\s+/g, ' ').slice(0, 180);
  }
  function isChatAction(element) {
    if (!element) return false;
    const text = titleText(element);
    const url = norm(element.getAttribute('href'));
    return /чатқа\s*қосыл|чатқа\s*кіру|чатқа\s*өту|чатқа|вступить\s+в\s+чат|закрытый\s+чат|чатқа\s*қатыс|telegram\s*чат|чат\s*қатыс|курс\s*чаты/.test(text)
      || /chat\.whatsapp\.com\/|(?:t|telegram)\.me\/(?:\+|joinchat\/)/.test(url);
  }
  function targetRoute(element) {
    for (const attr of ['href', 'data-route', 'data-page', 'data-target', 'data-section', 'aria-controls']) {
      const v = element.getAttribute(attr);
      if (v && v.includes('#')) return hash(v);
      if (v && paidRoute(v)) return hash(v);
    }
    const onclick = norm(element.getAttribute('onclick'));
    const found = onclick.match(/#([a-z0-9_-]+)/);
    return found ? found[1] : '';
  }
  function viewRoute(element) {
    const view = element.closest('.view[data-view],section[data-view],[data-page]');
    return view ? norm(view.getAttribute('data-view') || view.getAttribute('data-page')) : '';
  }
  function inPaidModule(element) {
    const route = viewRoute(element);
    return /^(?:module[-_ ]?[2-9]\d*|m[2-9]\d*[-_]?lesson.*|bonus[-_ ]lesson.*)$/.test(route);
  }
  function materialAction(element) {
    const label = titleText(element);
    const href = norm(element.getAttribute('href'));
    const role = norm(element.getAttribute('data-analytics'));
    return /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/.test(href)
      || /youtube\.com|youtu\.be|vimeo\.com|notion\.site/.test(href)
      || /бейнесабақ|сабақ|конспект|тапсырма|тест|жаттығу|материал|pdf|видео|бейнені|қарау|открыть\s+урок|скачать|смотреть|lesson|test|quiz|notes|practice|worksheet|homework/.test(label)
      || role === 'lesson';
  }
  function isAllowedNavigation(element) {
    const route = targetRoute(element);
    if (modulePage(route)) return true;
    if (/^(?:home|courses|course|catalog|modules|progress|profile|dashboard|account)$/.test(route)) return true;
    return !!(route && freeResources.has(route));
  }
  function shouldLock(element) {
    if (!element || !element.getAttribute) return false;
    if (isChatAction(element)) return 'chat';
    const target = targetRoute(element);
    if (target && paidRoute(target)) return 'lesson';
    if (isAllowedNavigation(element)) return false;
    if (inPaidModule(element) && materialAction(element)) return 'content';
    // When a paid resource uses an external URL from a dedicated paid lesson,
    // do not let the user bypass the gate through that URL.
    const parentView = viewRoute(element);
    if (paidRoute(parentView) && materialAction(element)) return 'content';
    return false;
  }
  function showLock(kind) {
    modalTitle.textContent = lockedTitle;
    modalText.textContent = messages[kind] || messages.content;
    modal.hidden = false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    understood.focus();
  }
  function hideLock() {
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
  understood.addEventListener('click', hideLock);
  modal.addEventListener('click', event => { if (event.target === modal) hideLock(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) hideLock(); });

  function actionFromTarget(node) {
    const el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el || !el.closest) return null;
    return el.closest('a,button,[role="button"],[onclick],[data-route],[data-target],.public-resource,.row-action,.lesson');
  }
  function intercept(event) {
    const target = actionFromTarget(event.target);
    if (!target) return;
    let action = target;
    let why = shouldLock(action);
    if (!why) {
      // Some cards are clickable via a parent wrapper, not the inner label.
      const parent = target.parentElement && target.parentElement.closest('[onclick],[data-route],a,button');
      if (parent && parent !== target) {
        action = parent;
        why = shouldLock(parent);
      }
    }
    if (!why) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    showLock(why);
  }

  function paidPage(route) {
    return paidRoute(route);
  }
  function overviewFor(route) {
    route = hash(route);
    if (/^lesson[-_]/.test(route) || /^(?:test|notes?|task|assignment|practice|quiz)[-_]2/.test(route)) return 'module-1';
    if (/^m2[-_]|^module[-_]2/.test(route)) return 'module-2';
    return 'courses';
  }
  function guardRoute() {
    if (!contentWin || redirecting) return;
    const current = hash(contentWin.location.hash);
    if (!paidPage(current)) return;
    redirecting = true;
    contentWin.location.hash = '#' + overviewFor(current);
    showLock('lesson');
    setTimeout(() => { redirecting = false; }, 100);
  }

  function getStyle(doc) {
    if (doc.getElementById('hc-preview-style')) return;
    const css = doc.createElement('style');
    css.id = 'hc-preview-style';
    css.textContent = [
      '.hc-preview-paid-card{position:relative!important;}',
      '.hc-preview-paid-card:after{content:"🔒 Төлемнен кейін";position:absolute;bottom:7px;right:9px;padding:4px 8px;',
      'background:#f3effa;color:#76569a;border:1px solid #e9e0f6;border-radius:30px;',
      'font:600 10px/1.3 Arial,sans-serif;pointer-events:none;opacity:.94;}',
      '.hc-preview-paid-media{position:relative!important;}',
      '.hc-preview-paid-media .hc-preview-media-mask{position:absolute!important;inset:0;z-index:25;',
      'display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;',
      'border-radius:14px;background:linear-gradient(140deg,#f6f2fd,#eee8f8);color:#6b5791;',
      'font:600 13px/1.6 Arial,sans-serif;}',
      '.hc-preview-paid-media .hc-preview-media-mask span{max-width:320px;}'
    ].join('');
    doc.head.appendChild(css);
  }
  function decorate(doc) {
    const actions = doc.querySelectorAll('a[href],button,[role="button"],[onclick],[data-route],[data-target],.public-resource,.row-action,.lesson');
    for (const item of actions) {
      const why = shouldLock(item);
      const isCard = item.matches('.card.lesson,.lesson-list a,.lesson-box a,.public-resource,.row-action') || item.closest('.lesson-list') !== null;
      if (why && isCard && !item.classList.contains('hc-preview-paid-card')) {
        item.classList.add('hc-preview-paid-card');
      }
      if (!why && item.classList.contains('hc-preview-paid-card')) item.classList.remove('hc-preview-paid-card');
    }
    // Never load embedded paid videos in the preview frame; still not a security boundary
    // because the full public course is hosted separately.
    const views = doc.querySelectorAll('.view[data-view]');
    for (const section of views) {
      const view = norm(section.dataset.view);
      if (view === 'lesson-1') continue;
      const videos = section.querySelectorAll('.lesson-video,.video-container,.video-wrapper,iframe[src*="youtube"],iframe[src*="vimeo"],video');
      for (const media of videos) {
        const wrap = media.matches('iframe,video') ? (media.closest('.lesson-video,.video-container,.video-wrapper') || media.parentElement) : media;
        if (!wrap || wrap.classList.contains('hc-preview-paid-media')) continue;
        wrap.classList.add('hc-preview-paid-media');
        const children = wrap.querySelectorAll('iframe,video,source');
        for (const video of children) {
          if (video.nodeName === 'VIDEO') { video.pause();video.removeAttribute('src');video.removeAttribute('poster'); }
          if (video.nodeName === 'SOURCE' || video.nodeName === 'IFRAME') video.removeAttribute('src');
        }
        const mask = doc.createElement('div');
        mask.className = 'hc-preview-media-mask';
        mask.innerHTML = '<span>🔒 Бейнесабақ толық курсқа төлем жасағаннан кейін ашылады</span>';
        wrap.appendChild(mask);
        mask.addEventListener('click', () => showLock('lesson'));
      }
    }
  }
  function scheduleDecorate() {
    if (repaintQueued || !contentWin || !contentDoc) return;
    repaintQueued = true;
    contentWin.requestAnimationFrame(() => {
      repaintQueued = false;
      decorate(contentDoc);
      guardRoute();
    });
  }
  function setup() {
    let win, doc;
    try { win = course.contentWindow; doc = win.document; void doc.body; } catch (_) { return; }
    if (!doc || !doc.body) return;
    if (contentDoc === doc && contentDoc.documentElement.dataset.hcPreview === 'active') return;
    if (activeObserver) activeObserver.disconnect();
    contentWin = win;
    contentDoc = doc;
    doc.documentElement.dataset.hcPreview = 'active';
    getStyle(doc);
    doc.addEventListener('click', intercept, true);
    doc.addEventListener('auxclick', intercept, true);
    doc.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') intercept(event);
    }, true);
    win.addEventListener('hashchange', () => { guardRoute();scheduleDecorate(); });
    win.addEventListener('popstate', () => { guardRoute();scheduleDecorate(); });
    activeObserver = new win.MutationObserver(scheduleDecorate);
    activeObserver.observe(doc.body, { childList:true, subtree:true });
    guardRoute();
    scheduleDecorate();
  }
  course.addEventListener('load', setup);
  if (course.contentDocument && course.contentDocument.readyState === 'complete') setup();
})();
