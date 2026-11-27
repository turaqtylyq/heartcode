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
  // Only the first lesson (and its existing module-1 practice/notes) is free.
  // All module OVERVIEWS remain navigable, including modules 2-4 and bonus.
  const freeResources = new Set(['lesson-1', 'module-1-practice', 'notes-1', 'note-1', 'test-1', 'quiz-1', 'task-1', 'assignment-1', 'practice-1']);
  const restrictedRoutes = new Set([
    'lesson-2',
    'm2-lesson-1', 'm2-lesson-2', 'm2-lesson-3',
    'module-2-practice', 'module-3-practice', 'module-4-practice',
    'm3-lesson-1', 'm4-lesson-1',
    'bonus-lesson-1'
  ]);
  function paidRoute(value) {
    const route = hash(value);
    if (!route || freeResources.has(route) || modulePage(route) || route === 'bonus-module') return false;
    if (restrictedRoutes.has(route)) return true;
    // Future lessons/practices should never accidentally become free.
    return /^(?:m[2-9]\d*[-_]?lesson[-_]?\d*|module[-_]?[2-9]\d*[-_](?:lesson|notes?|tests?|quizzes?|tasks?|assignments?|practices?|videos?)(?:[-_]\d+)?|bonus[-_](?:lesson|practice|test|notes?)(?:[-_]\d+)?|lesson[-_]\d+|notes?[-_]\d+|tests?[-_]\d+|quizzes?[-_]\d+|tasks?[-_]\d+|assignment[-_]\d+|practice[-_]\d+)(?:$|[-_])/.test(route)
      || /^(?:treatment|paid-content|video-lesson)/.test(route);
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
    const view = element.closest('.view[data-page],section[data-page],.view[data-view],section[data-view]');
    return view ? norm(view.getAttribute('data-page') || view.getAttribute('data-view')) : '';
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
    // Older previews added huge diagonal pseudo-labels to entire module cards.
    // Remove them completely, including in cached page states.
    const previous = doc.getElementById('hc-demo-css');
    if (previous) previous.remove();
    if (doc.getElementById('hc-preview-style')) doc.getElementById('hc-preview-style').remove();
    const css = doc.createElement('style');
    css.id = 'hc-preview-style';
    css.textContent = [
      '.hc-demo-locked:after,.hc-preview-paid-card:after{content:none!important;display:none!important;}',
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
    // All module cards are ordinary navigable links: no lock labels or overlays.
    // Restrictions happen only when an actual lesson/material/chat is opened.
    for (const el of doc.querySelectorAll('.hc-demo-locked,.hc-preview-paid-card,[data-hc-demo-locked]')) {
      el.classList.remove('hc-demo-locked', 'hc-preview-paid-card');
      el.removeAttribute('data-hc-demo-locked');
    }
    // Never load embedded paid videos in the preview frame; still not a security boundary
    // because the full public course is hosted separately.
    const views = doc.querySelectorAll('.view[data-page],.view[data-view]');
    for (const section of views) {
      const view = norm(section.dataset.page || section.dataset.view);
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
        mask.innerHTML = '<span>🔒 Бейнесабақты көру үшін толық қолжетімділік қажет<br><small>Ақпарат алу үшін басыңыз</small></span>';
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
    // Main platform uses history.pushState() and render() directly;
    // that does not trigger a hashchange event. Guard it explicitly too.
    const originalPushState = win.history.pushState.bind(win.history);
    win.history.pushState = function(state, title, url) {
      const requested = typeof url === 'string' && url.includes('#') ? hash(url) : '';
      if (paidRoute(requested)) { showLock('lesson'); return; }
      return originalPushState(state, title, url);
    };
    win.addEventListener('hashchange', () => { guardRoute();scheduleDecorate(); });
    win.addEventListener('popstate', () => { guardRoute();scheduleDecorate(); });
    activeObserver = new win.MutationObserver(scheduleDecorate);
    activeObserver.observe(doc.body, { childList:true, attributes:true, attributeFilter:['class'], subtree:true });
    guardRoute();
    scheduleDecorate();
  }
  course.addEventListener('load', setup);
  if (course.contentDocument && course.contentDocument.readyState === 'complete') setup();
})();
