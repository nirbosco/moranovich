/* ==========================================================================
   Moranovich · studio.js  (Moran's editor)
   Phone-first. Screens: gate -> list | archive -> edit (+ live preview) -> share.
   Data: MV.createStore() (LocalStore this milestone). Preview: MV.renderPage.
   Micro-copy: 03-copy.md section 3, feminine singular.
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV;
  var esc = MV.esc;
  var store = MV.createStore();
  var app = document.getElementById('st-app');
  var toastEl = document.getElementById('st-toast');
  var SITE = 'https://moranovich.com/';
  var base = null;
  var state = { view: 'list', draft: null, auto: {}, mode: 'form', dirty: false };

  /* ---------- copy (03-copy.md §3) ---------- */
  var T = {
    listTitle: 'הדפים שלי', listSub: 'כל מתחם מקבל דף ולינק משלו',
    editTitle: 'עריכת דף', editSub: 'השינויים נשמרים תוך כדי',
    previewTitle: 'ככה זה ייראה', previewSub: 'בדיוק כמו בטלפון של מי שמקבל את הלינק',
    shareTitle: 'הדף מוכן לשליחה', shareSub: 'לינק, קוד QR והודעה מוכנה לוואטסאפ',
    archiveTitle: 'ארכיון', archiveSub: 'דפים שסיימו את העבודה. אפשר להחזיר אותם בכל רגע',
    newPage: 'דף חדש', duplicate: 'שכפול', publish: 'פרסום', update: 'עדכון הדף',
    saveAndLink: 'שמירה וקבלת לינק',
    copyLink: 'העתקת לינק', qr: 'קוד QR להדפסה', sendWa: 'שליחה בוואטסאפ',
    archive: 'העברה לארכיון', restore: 'החזרה לדפים שלי', preview: 'תצוגה מקדימה', back: 'חזרה',
    edit: 'עריכה', share: 'שיתוף', modeForm: 'עריכה', modePreview: 'תצוגה', cancel: 'ביטול', later: 'עוד רגע',
    tCopied: 'הלינק הועתק', tDuplicated: 'הדף שוכפל. עכשיו רק לשנות את הפנייה והפרטים',
    tArchived: 'הדף עבר לארכיון', tRestored: 'הדף חזר לרשימה',
    emptyTitle: 'כאן יופיעו הדפים שלך', emptyText: 'מתחילים מדף חדש, או משכפלים את דף הבסיס ומשנים רק את הפנייה.',
    published: 'הדף באוויר! הלינק מוכן לשליחה.',
    eGreeting: 'כתבי פנייה קצרה, היא השורה הראשונה שרואים בדף.',
    eVenue: 'כתבי את שם המתחם, הוא נכנס להודעת הוואטסאפ.',
    eSlugTaken: 'הכתובת הזאת כבר בשימוש. נסי תוספת קטנה, למשל {slug}-2.',
    eSlugChars: 'בכתובת אפשר רק אותיות באנגלית, ספרות ומקף.',
    eLong: 'קצת ארוך. נסי לקצר עד {x} תווים.',
    eLongGreeting: 'קצת ארוך. נסי לקצר לשורה אחת.',
    eLanes: 'סמני לפחות מסלול אחד להצגה.',
    eSave: 'השינויים לא נשמרו. בדקי את החיבור לאינטרנט ונסי שוב.',
    ePublish: 'הדף לא פורסם. נסי שוב בעוד דקה, והשינויים שלך מחכים כאן.',
    status: { draft: 'טיוטה', published: 'באוויר', archived: 'בארכיון' },
    // Not in 03-copy.md (written here, flagged for the Copywriter):
    gateTitle: 'הסטודיו של מורן', gatePin: 'קוד אישי', gateGo: 'כניסה',
    newFromBase: 'מדף הבסיס', newFromBaseSub: 'דף חדש עם הפרטים הקבועים שלך',
    newOrDup: 'או שכפול של דף קיים',
    baseCard: 'דף הבסיס', slugLocked: 'אחרי הפרסום הכתובת קבועה, כדי שלינקים שכבר נשלחו ימשיכו לעבוד. לכתובת אחרת, שכפלי את הדף.',
    shareMsgLabel: 'הודעה להעברה במתחם', addDot: 'הוספת נקודה אמצעית',
    qrOffline: 'קוד ה-QR יופיע כשיהיה חיבור לאינטרנט.'
  };
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }

  var FIELDS = [
    { k: 'venue', label: 'שם המתחם', hint: 'ככה הוא יופיע בהודעת הוואטסאפ ובכותרת', max: 30, req: T.eVenue },
    { k: 'slug', label: 'כתובת הדף', hint: 'אותיות באנגלית ומקף, למשל country-hadkalim', max: 30, ltr: true },
    { k: 'greeting', label: 'פנייה', hint: 'שורה אחת, עד 40 תווים. "שלום ל..." עובד תמיד', max: 40, req: T.eGreeting, over: T.eLongGreeting },
    { k: 'note', label: 'הודעה אישית', hint: '2-3 שורות: למה את כאן, מתי ולמי', max: 180, area: 3 },
    { k: 'details', label: 'פרטים', hint: 'ימים, שעות ומקום', max: 80, dot: true },
    { k: 'offer', label: 'הצעה (לא חובה)', hint: 'הטבה אחת. אם תשאירי ריק, השורה לא תופיע', max: 70 },
    { k: 'lanes', label: 'מסלולים להצגה', hint: 'סמני את מה שמתאים לקהל של המתחם', lanes: true },
    { k: 'waText', label: 'הודעת וואטסאפ מוכנה', hint: 'שם המתחם כבר בפנים, כך תדעי מאיפה הגיעה הפנייה', max: 140, area: 3 },
    { k: 'ogTitle', label: 'כותרת לשיתוף', hint: 'מה שרואים בוואטסאפ לפני שלוחצים על הלינק', max: 60 }
  ];

  /* ---------- helpers ---------- */
  var toastTimer = 0;
  function toast(msg) {
    var open = document.querySelector('dialog[open]');
    (open || document.body).appendChild(toastEl); // stay above the modal top layer
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }
  function link(slug) { return SITE + slug; }
  function shortLink(slug) { return 'moranovich.com/' + slug; }
  function dateStr(iso) {
    try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
  }
  function defaultShare(venue) {
    return "היי, כאן מורן רבינוביץ, מאמנת שחייה פרטית. הכנתי דף קצר במיוחד עבור " + venue +
      ', עם כל הפרטים ודרך מהירה לפנות אליי: [לינק]. אשמח אם אפשר להעביר אותו הלאה. תודה רבה!';
  }

  /* Hebrew -> Latin slug suggestion. Rough on purpose; Moran can edit it. */
  var WORDS = { 'קאנטרי': 'country', 'קנטרי': 'country', 'מתנס': 'matnas', 'בית ספר': 'school', 'ביהס': 'school',
    'שכונת': 'shchunat', 'שכונה': 'shchuna', 'בריכת': 'breichat', 'בריכה': 'breicha', 'קיבוץ': 'kibbutz',
    'מושב': 'moshav', 'קלאב': 'club', 'ספורט': 'sport', 'מרכז': 'merkaz', 'גן': 'gan', 'ועד': 'vaad', 'בניין': 'binyan' };
  var LET = { 'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
    'כ': 'k', 'ך': 'ch', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f',
    'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't' };
  function translitWord(w) {
    if (WORDS[w]) return WORDS[w];
    var out = '';
    for (var i = 0; i < w.length; i++) {
      var ch = w[i], first = i === 0, last = i === w.length - 1;
      if (first && ch === 'ה' && w.length > 3) { out += 'ha'; continue; }
      if (ch === 'י' && w[i + 1] === 'ם' && i + 2 === w.length) { out += 'im'; i++; continue; }
      if (ch === 'ו' && w[i + 1] === 'ת' && i + 2 === w.length) { out += 'ot'; i++; continue; }
      if (ch === 'ו' && !first) { out += (w[i + 1] === 'ו' ? 'v' : 'o'); if (w[i + 1] === 'ו') i++; continue; }
      if (ch === 'י' && !first && !last) { out += 'i'; continue; }
      if (ch === 'ה' && last) { out += 'a'; continue; }
      if (ch === 'ב' && !first && !/[ו]/.test(w[i - 1])) { out += 'v'; continue; }
      if (ch === 'כ' && !first) { out += 'ch'; continue; }
      if (ch === 'פ' && !first) { out += 'f'; continue; }
      out += LET[ch] || (/[a-z0-9]/i.test(ch) ? ch.toLowerCase() : '');
    }
    return out;
  }
  function suggestSlug(name) {
    var s = String(name || '').replace(/["'״׳`]/g, '').trim();
    if (!s) return '';
    Object.keys(WORDS).forEach(function (k) { if (k.indexOf(' ') > -1) s = s.split(k).join(WORDS[k]); });
    return s.split(/[\s\-_.,/]+/).map(translitWord).filter(Boolean).join('-')
      .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  }
  MV.suggestSlug = suggestSlug;

  /* ---------- dialogs ---------- */
  function dialog(html, cls) {
    var d = document.createElement('dialog');
    d.className = 'st-dialog ' + (cls || '');
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 0); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close('cancel'); });
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    return d;
  }
  function confirmBox(text, okLabel, cancelLabel) {
    return new Promise(function (res) {
      var d = dialog('<form method="dialog" class="st-confirm"><p>' + text + '</p><div class="st-confirm-actions">' +
        '<button class="st-btn st-btn-primary" value="ok">' + esc(okLabel) + '</button>' +
        '<button class="st-btn st-btn-ghost" value="cancel">' + esc(cancelLabel) + '</button></div></form>', 'st-dialog-sm');
      d.addEventListener('close', function () { res(d.returnValue === 'ok'); });
    });
  }

  /* ---------- gate (VISUAL ONLY this milestone) ----------
     Any PIN is accepted. Next milestone: SupabaseStore verifies it through
     rpc mv_admin_op(pin,'list'), 5 wrong tries lock for 10 minutes. */
  function showGate() {
    app.innerHTML = '<main class="st-gate"><form class="st-gate-card" novalidate>' +
      MV.monoSvg('mv-mono st-gate-mono') +
      '<h1 class="st-h1">' + esc(T.gateTitle) + '</h1>' +
      '<label class="st-label" for="st-pin">' + esc(T.gatePin) + '</label>' +
      '<input id="st-pin" class="st-input st-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8">' +
      '<button class="st-btn st-btn-primary" type="submit">' + esc(T.gateGo) + '</button>' +
      '</form></main>';
    var f = app.querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      MV.safeStorage.set('mv.pin', f.querySelector('input').value || 'demo');
      showList();
    });
    f.querySelector('input').focus();
  }

  /* ---------- list / archive ---------- */
  function statusChip(p) {
    return '<span class="st-status st-status--' + esc(p.status) + '">' + esc(T.status[p.status] || p.status) + '</span>';
  }
  function cardHtml(p, archived) {
    var actions = archived ?
      '<button type="button" class="st-act" data-act="restore" data-id="' + esc(p.id) + '">' + esc(T.restore) + '</button>' :
      '<button type="button" class="st-act" data-act="edit" data-id="' + esc(p.id) + '">' + esc(T.edit) + '</button>' +
      '<button type="button" class="st-act" data-act="dup" data-id="' + esc(p.id) + '">' + esc(T.duplicate) + '</button>' +
      '<button type="button" class="st-act" data-act="share" data-id="' + esc(p.id) + '">' + esc(T.share) + '</button>';
    return '<li class="st-card">' +
      '<div class="st-card-strip">' + statusChip(p) + '<span class="st-date">' + esc(dateStr(p.updatedAt)) + '</span></div>' +
      '<div class="st-card-body"><h2 class="st-card-title">' + esc(p.venue || '·') + '</h2>' +
        '<p class="st-card-link"><bdi dir="ltr">' + esc(shortLink(p.slug)) + '</bdi></p></div>' +
      '<div class="st-card-actions">' + actions + '</div></li>';
  }
  function showList(archived) {
    state.view = archived ? 'archive' : 'list';
    return store.listPages({ archived: !!archived }).then(function (pages) {
      var head = '<header class="st-head">' +
        '<div class="st-brand">' + MV.monoSvg('mv-mono') + '<span lang="en">MORANOVICH</span></div>' +
        '<h1 class="st-h1">' + esc(archived ? T.archiveTitle : T.listTitle) + '</h1>' +
        '<p class="st-sub">' + esc(archived ? T.archiveSub : T.listSub) + '</p>' +
        '<div class="st-seg" role="group">' +
          '<button type="button" data-nav="list" aria-pressed="' + (!archived) + '">' + esc(T.listTitle) + '</button>' +
          '<button type="button" data-nav="archive" aria-pressed="' + (!!archived) + '">' + esc(T.archiveTitle) + '</button>' +
        '</div></header>';
      var body = '';
      if (!archived) {
        body += '<div class="st-card st-card-base"><div class="st-card-strip"><span class="st-status st-status--base">' + esc(T.baseCard) + '</span></div>' +
          '<div class="st-card-body"><h2 class="st-card-title">' + esc(MV.withDefaults(base).card.baseVenue) + '</h2><p class="st-card-link"><bdi dir="ltr">moranovich.com</bdi></p></div>' +
          '<div class="st-card-actions"><a class="st-act" href="index.html" target="_blank" rel="noopener">' + esc(T.preview) + '</a>' +
          '<button type="button" class="st-act" data-act="new-base">' + esc(T.duplicate) + '</button></div></div>';
      }
      if (!pages.length && !archived) {
        body += '<div class="st-empty"><h2>' + esc(T.emptyTitle) + '</h2><p>' + esc(T.emptyText) + '</p>' +
          '<button type="button" class="st-btn st-btn-primary" data-act="new">' + esc(T.newPage) + '</button></div>';
      } else {
        body += '<ul class="st-cards">' + pages.map(function (p) { return cardHtml(p, archived); }).join('') + '</ul>';
      }
      app.innerHTML = '<main class="st-list">' + head + body + '</main>' +
        (archived ? '' : '<button type="button" class="st-fab" data-act="new"><span aria-hidden="true">+</span>' + esc(T.newPage) + '</button>');
      global.scrollTo(0, 0);
    });
  }

  function newPageSheet() {
    store.listPages().then(function (pages) {
      var d = dialog('<div class="st-sheet"><div class="st-sheet-head"><h2 class="st-h2">' + esc(T.newPage) + '</h2>' +
        '<button type="button" class="st-close" value="cancel" aria-label="' + esc(T.back) + '">×</button></div>' +
        '<button type="button" class="st-choice" data-new="base"><b>' + esc(T.newFromBase) + '</b><span>' + esc(T.newFromBaseSub) + '</span></button>' +
        (pages.length ? '<p class="st-sheet-sep">' + esc(T.newOrDup) + '</p><ul class="st-choices">' + pages.map(function (p) {
          return '<li><button type="button" class="st-choice" data-new="' + esc(p.id) + '"><b>' + esc(p.venue) + '</b><span><bdi dir="ltr">' + esc(shortLink(p.slug)) + '</bdi></span></button></li>';
        }).join('') + '</ul>' : '') + '</div>', 'st-dialog-sheet');
      d.addEventListener('click', function (e) {
        if (e.target.closest('.st-close')) { d.close(); return; }
        var b = e.target.closest('[data-new]');
        if (!b) return;
        d.close();
        var v = b.getAttribute('data-new');
        if (v === 'base') openEditor(blankPage());
        else duplicate(v);
      });
    });
  }
  function blankPage() {
    return { id: null, slug: '', venue: '', greeting: '', note: '', details: '', offer: '', waText: '', ogTitle: '',
      lanes: [1, 2, 3, 4, 5], heroUrl: '', heroVideo: '', shareText: '', status: 'draft', publishedAt: null };
  }
  function duplicate(id) {
    return store.duplicatePage(id).then(function (p) { toast(T.tDuplicated); openEditor(p); });
  }

  /* ---------- editor ---------- */
  function fieldHtml(f, p) {
    var locked = f.k === 'slug' && !!p.publishedAt;
    var id = 'st-f-' + f.k;
    var hint = locked ? T.slugLocked : f.hint;
    var ctl;
    if (f.lanes) {
      var lanes = (MV.withDefaults(base).lanes || base.lanes || []);
      ctl = '<div class="st-lanes" role="group" aria-labelledby="' + id + '-l" aria-describedby="' + id + '-h">' + lanes.map(function (l) {
        l = { id: MV.laneNum(l), title: l.title, line: l.text || l.line };
        var on = (p.lanes || []).map(Number).indexOf(Number(l.id)) > -1;
        return '<label class="st-switch"><input type="checkbox" role="switch" name="lane" value="' + esc(l.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="st-switch-ui" aria-hidden="true"></span><span class="st-switch-n">' + esc(l.id) + '</span><span class="st-switch-t">' + esc(l.title) + '</span></label>';
      }).join('') + '</div>';
      return '<div class="st-field" data-k="lanes"><p class="st-label" id="' + id + '-l">' + esc(f.label) + '</p>' + ctl +
        '<p class="st-hint" id="' + id + '-h">' + esc(hint) + '</p><p class="st-err" hidden></p></div>';
    }
    var val = esc(p[f.k] || '');
    var attrs = ' id="' + id + '" name="' + f.k + '" aria-describedby="' + id + '-h ' + id + '-c"' + (locked ? ' readonly' : '') +
      (f.ltr ? ' dir="ltr" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url"' : '');
    ctl = f.area ? '<textarea class="st-input st-area" rows="' + f.area + '"' + attrs + '>' + val + '</textarea>' :
      '<input class="st-input" type="text"' + attrs + ' value="' + val + '">';
    if (f.ltr) ctl = '<div class="st-affix"><span class="st-prefix" dir="ltr">moranovich.com/</span>' + ctl + '</div>';
    if (f.dot) ctl = '<div class="st-withdot">' + ctl + '<button type="button" class="st-dot" data-dot="' + id + '" aria-label="' + esc(T.addDot) + '">·</button></div>';
    return '<div class="st-field" data-k="' + f.k + '">' +
      '<div class="st-label-row"><label class="st-label" for="' + id + '">' + esc(f.label) + '</label>' +
      (f.max ? '<span class="st-count mv-num" id="' + id + '-c" aria-live="polite"></span>' : '') + '</div>' + ctl +
      '<p class="st-hint" id="' + id + '-h">' + esc(hint) + '</p><p class="st-err" hidden></p></div>';
  }

  function openEditor(page) {
    state.view = 'edit';
    state.draft = JSON.parse(JSON.stringify(page));
    state.mode = 'form';
    var p = state.draft;
    state.auto = {
      slug: !p.publishedAt && (!p.slug || p.slug === suggestSlug(p.venue)),
      waText: !p.waText || p.waText === MV.defaultWaText(p.venue),
      ogTitle: !p.ogTitle || p.ogTitle === MV.defaultOgTitle(p.venue)
    };
    var isPub = p.status === 'published';
    app.innerHTML = '<div class="st-edit" data-mode="form">' +
      '<header class="st-top"><button type="button" class="st-back" data-act="back">' + esc(T.back) + '</button>' +
        '<div class="st-top-t"><h1 class="st-h1">' + esc(T.editTitle) + '</h1><p class="st-sub">' + esc(T.editSub) + '</p></div>' +
        '<span class="st-top-status">' + statusChip(p) + '</span></header>' +
      '<div class="st-seg st-seg-mode" role="group">' +
        '<button type="button" data-mode="form" aria-pressed="true">' + esc(T.modeForm) + '</button>' +
        '<button type="button" data-mode="preview" aria-pressed="false">' + esc(T.modePreview) + '</button></div>' +
      '<div class="st-edit-grid">' +
        '<form class="st-form" novalidate autocomplete="off">' + FIELDS.map(function (f) { return fieldHtml(f, p); }).join('') +
          (p.id ? '<button type="button" class="st-link-btn" data-act="archive">' + esc(T.archive) + '</button>' : '') +
        '</form>' +
        '<section class="st-preview" aria-label="' + esc(T.previewTitle) + '"><div class="st-preview-head"><h2 class="st-h2">' + esc(T.previewTitle) + '</h2>' +
          '<p class="st-sub">' + esc(T.previewSub) + '</p></div>' +
          '<div class="st-phone"><div class="st-phone-screen" id="st-pv"></div></div></section>' +
      '</div>' +
      '<div class="st-bar"><button type="button" class="st-btn st-btn-primary st-save" data-act="save">' + esc(isPub ? T.update : T.saveAndLink) + '</button></div>' +
    '</div>';
    FIELDS.forEach(function (f) { if (f.max) updateCount(f); });
    renderPreview();
    global.scrollTo(0, 0);
  }

  function formEl() { return app.querySelector('.st-form'); }
  function fieldDef(k) { for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].k === k) return FIELDS[i]; return null; }
  function setVal(k, v) {
    state.draft[k] = v;
    var el = formEl() && formEl().elements[k];
    if (el && el.value !== v) el.value = v;
    if (fieldDef(k) && fieldDef(k).max) updateCount(fieldDef(k));
  }
  function updateCount(f) {
    var c = document.getElementById('st-f-' + f.k + '-c');
    if (!c) return;
    var n = (state.draft[f.k] || '').length;
    c.textContent = n + '/' + f.max;
    var over = n > f.max;
    c.classList.toggle('is-over', over);
    var wrap = c.closest('.st-field');
    if (over) showErr(wrap, f.over || fmt(T.eLong, { x: f.max }));
    else if (wrap.getAttribute('data-err') === 'long') showErr(wrap, '');
    if (over) wrap.setAttribute('data-err', 'long');
  }
  function showErr(wrap, msg) {
    var p = wrap.querySelector('.st-err');
    p.hidden = !msg; p.textContent = msg || '';
    wrap.classList.toggle('is-invalid', !!msg);
    if (!msg) wrap.removeAttribute('data-err');
    var input = wrap.querySelector('input,textarea');
    if (input && input.type !== 'checkbox') {
      if (msg) { p.id = input.id + '-e'; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-errormessage', p.id); }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-errormessage'); }
    }
  }

  var pvTimer = 0, saveTimer = 0;
  function renderPreview() {
    var el = document.getElementById('st-pv');
    if (!el) return;
    MV.renderPage(base, state.draft, el, { preview: true });
  }
  function schedule() {
    clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 140);
    clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700);
  }
  function autosave() {
    var p = state.draft;
    if (!p || !p.venue || !p.slug || !MV.SLUG_RE.test(p.slug)) return Promise.resolve(null);
    return store.savePage(p).then(function (rec) {
      p.id = rec.id; p.createdAt = rec.createdAt; p.updatedAt = rec.updatedAt;
      var w = app.querySelector('[data-k="slug"]');
      if (w && w.getAttribute('data-err') === 'slug') showErr(w, '');
      if (!app.querySelector('[data-act="archive"]') && formEl()) {
        formEl().insertAdjacentHTML('beforeend', '<button type="button" class="st-link-btn" data-act="archive">' + esc(T.archive) + '</button>');
      }
      return rec;
    }).catch(function (e) {
      var w = app.querySelector('[data-k="slug"]');
      if (e && e.code === 'slug_taken' && w) { showErr(w, fmt(T.eSlugTaken, { slug: p.slug })); w.setAttribute('data-err', 'slug'); }
      else if (e && e.code !== 'slug_invalid') toast(T.eSave);
      return null;
    });
  }

  function onInput(e) {
    var t = e.target;
    if (!t.name || state.view !== 'edit') return;
    var p = state.draft;
    if (t.name === 'lane') {
      p.lanes = Array.prototype.slice.call(formEl().querySelectorAll('input[name="lane"]:checked')).map(function (x) { return Number(x.value); });
      var w = app.querySelector('[data-k="lanes"]');
      if (p.lanes.length) showErr(w, '');
      schedule();
      return;
    }
    var oldVenue = p.venue;
    var v = t.value;
    if (t.name === 'slug') {
      v = v.toLowerCase().replace(/\s+/g, '-');
      if (v !== t.value) { var pos = t.selectionStart; t.value = v; try { t.setSelectionRange(pos, pos); } catch (x) {} }
      state.auto.slug = false;
      var sw = t.closest('.st-field');
      if (v && !/^[a-z0-9-]*$/.test(v)) { showErr(sw, T.eSlugChars); sw.setAttribute('data-err', 'chars'); }
      else if (sw.getAttribute('data-err') === 'chars' || sw.getAttribute('data-err') === 'slug') showErr(sw, '');
    }
    if (t.name === 'waText') state.auto.waText = false;
    if (t.name === 'ogTitle') state.auto.ogTitle = false;
    p[t.name] = v;
    var f = fieldDef(t.name);
    if (f && f.max) updateCount(f);
    if (f && f.req && v.trim()) { var fw = t.closest('.st-field'); if (fw.getAttribute('data-err') !== 'long') showErr(fw, ''); }
    if (t.name === 'venue') {
      if (state.auto.slug) setVal('slug', suggestSlug(v));
      if (state.auto.waText) setVal('waText', v ? MV.defaultWaText(v) : '');
      if (state.auto.ogTitle) setVal('ogTitle', v ? MV.defaultOgTitle(v) : '');
      void oldVenue;
    }
    schedule();
  }

  function validate() {
    var p = state.draft, first = null;
    function fail(k, msg, tag) {
      var w = app.querySelector('[data-k="' + k + '"]');
      showErr(w, msg); w.setAttribute('data-err', tag || 'req');
      if (!first) first = w;
    }
    FIELDS.forEach(function (f) {
      if (f.req && !String(p[f.k] || '').trim()) fail(f.k, f.req);
      else if (f.max && String(p[f.k] || '').length > f.max) fail(f.k, f.over || fmt(T.eLong, { x: f.max }), 'long');
    });
    if (!p.slug || !MV.SLUG_RE.test(p.slug)) fail('slug', T.eSlugChars, 'chars');
    if (!p.lanes || !p.lanes.length) fail('lanes', T.eLanes);
    if (first) {
      setMode('form');
      var input = first.querySelector('input,textarea');
      first.scrollIntoView({ block: 'center', behavior: MV.prefersReducedMotion() ? 'auto' : 'smooth' });
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 200);
      return Promise.resolve(false);
    }
    return store.slugFree(p.slug, p.id).then(function (free) {
      if (!free) { fail('slug', fmt(T.eSlugTaken, { slug: p.slug }), 'slug'); first.querySelector('input').focus(); return false; }
      return true;
    });
  }

  function saveAndShare() {
    var btn = app.querySelector('.st-save');
    validate().then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      clearTimeout(saveTimer);
      return store.savePage(state.draft).then(function (rec) {
        state.draft = rec;
        if (rec.status === 'published') return { rec: rec, fresh: false };
        return confirmBox('לפרסם את הדף? הוא יהיה זמין בכתובת <bdi dir="ltr">' + esc(shortLink(rec.slug)) + '</bdi>', T.publish, T.later)
          .then(function (yes) {
            if (!yes) return null;
            return store.publishPage(rec.id).then(function (pub) { return { rec: pub, fresh: true }; })
              .catch(function () { toast(T.ePublish); return null; });
          });
      }).then(function (r) {
        btn.disabled = false;
        if (!r) return;
        state.draft = r.rec;
        btn.textContent = T.update;
        var st = app.querySelector('.st-top-status'); if (st) st.innerHTML = statusChip(r.rec);
        lockSlug();
        shareSheet(r.rec, r.fresh);
      }, function () { btn.disabled = false; toast(T.eSave); });
    });
  }
  function lockSlug() {
    var s = formEl() && formEl().elements.slug;
    if (s && state.draft.publishedAt) {
      s.readOnly = true;
      var h = document.getElementById('st-f-slug-h'); if (h) h.textContent = T.slugLocked;
    }
  }

  function setMode(mode) {
    state.mode = mode;
    var ed = app.querySelector('.st-edit');
    if (!ed) return;
    ed.setAttribute('data-mode', mode);
    app.querySelectorAll('.st-seg-mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
    if (mode === 'preview') { renderPreview(); global.scrollTo(0, 0); }
  }

  function archiveFlow() {
    var p = state.draft;
    confirmBox('להעביר את "' + esc(p.venue) + '" לארכיון? עד שתחזירי אותו, הלינק יוביל לדף הבסיס.', T.archive, T.cancel).then(function (yes) {
      if (!yes) return;
      (p.id ? store.archivePage(p.id) : Promise.resolve()).then(function () { toast(T.tArchived); showList(); });
    });
  }

  /* ---------- share sheet ---------- */
  function drawQR(canvas, text, size) {
    if (!global.qrcode) return false;
    var qr = global.qrcode(0, 'H');
    qr.addData(text); qr.make();
    var n = qr.getModuleCount(), quiet = 4, total = n + quiet * 2;
    var cell = size / total;
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#26211D';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        var x = Math.floor((c + quiet) * cell), y = Math.floor((r + quiet) * cell);
        ctx.fillRect(x, y, Math.ceil((c + quiet + 1) * cell) - x, Math.ceil((r + quiet + 1) * cell) - y);
      }
    }
    // monogram in the centre (error correction H keeps it scannable)
    var box = Math.round(n * 0.26) * cell, bx = (size - box) / 2, pad = box * 0.1;
    ctx.fillStyle = '#FFFFFF';
    var rr = box * 0.18;
    ctx.beginPath();
    ctx.moveTo(bx + rr, bx); ctx.arcTo(bx + box, bx, bx + box, bx + box, rr); ctx.arcTo(bx + box, bx + box, bx, bx + box, rr);
    ctx.arcTo(bx, bx + box, bx, bx, rr); ctx.arcTo(bx, bx, bx + box, bx, rr); ctx.closePath(); ctx.fill();
    if (global.Path2D) {
      var P = MV.MONOGRAM_PATHS, s = (box - pad * 2) / 100;
      ctx.save(); ctx.translate(bx + pad, bx + pad - s * 6); ctx.scale(s, s);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [[P.a, '#7E7061', 10], [P.b, '#DE1B87', 10], [P.w, '#3FC9CD', 7]].forEach(function (d) {
        ctx.strokeStyle = d[1]; ctx.lineWidth = d[2]; ctx.stroke(new Path2D(d[0]));
      });
      ctx.restore();
    }
    return true;
  }
  function copyText(text, input) {
    function fallback() {
      try { input.focus(); input.select(); input.setSelectionRange(0, 9999); var ok = document.execCommand('copy'); if (ok) toast(T.tCopied); } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(T.tCopied); }, fallback);
    } else fallback();
  }
  function shareSheet(p, fresh) {
    var url = link(p.slug);
    var qrUrl = url + '/?s=qr';
    var msg = p.shareText || defaultShare(p.venue);
    function waHref(m) {
      var text = m.indexOf('[לינק]') > -1 ? m.split('[לינק]').join(url) : m + ' ' + url;
      return 'https://wa.me/?text=' + encodeURIComponent(text);
    }
    var d = dialog('<div class="st-sheet st-share">' +
      '<div class="st-sheet-head"><div><h2 class="st-h2">' + esc(T.shareTitle) + '</h2><p class="st-sub">' + esc(T.shareSub) + '</p></div>' +
        '<button type="button" class="st-close" aria-label="' + esc(T.back) + '">×</button></div>' +
      (fresh ? '<p class="st-success">' + esc(T.published) + '</p>' : '') +
      '<div class="st-linkbox"><input class="st-input st-link-input" dir="ltr" readonly value="' + esc(url) + '" aria-label="' + esc(T.copyLink) + '">' +
        '<button type="button" class="st-btn st-btn-secondary" data-share="copy">' + esc(T.copyLink) + '</button></div>' +
      '<div class="st-qr"><canvas class="st-qr-c" width="240" height="240" role="img" aria-label="' + esc(T.qr + ' · ' + shortLink(p.slug)) + '"></canvas>' +
        '<button type="button" class="st-btn st-btn-secondary" data-share="qr">' + esc(T.qr) + '</button></div>' +
      '<div class="st-field"><label class="st-label" for="st-share-msg">' + esc(T.shareMsgLabel) + '</label>' +
        '<textarea id="st-share-msg" class="st-input st-area" rows="5">' + esc(msg) + '</textarea></div>' +
      '<a class="st-btn st-btn-wa" data-share="wa" href="' + esc(waHref(msg)) + '" target="_blank" rel="noopener">' +
        '<svg class="mv-ico" aria-hidden="true"><use href="#mv-i-wa"/></svg>' + esc(T.sendWa) + '</a>' +
      '<a class="st-link-btn st-center" href="index.html#' + esc(p.slug) + '" target="_blank" rel="noopener">' + esc(T.preview) + '</a>' +
    '</div>', 'st-dialog-sheet');

    var canvas = d.querySelector('.st-qr-c');
    function paintQR() {
      if (!drawQR(canvas, qrUrl, 480)) {
        canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'st-hint', textContent: T.qrOffline }));
        var qb = d.querySelector('[data-share="qr"]'); if (qb) qb.disabled = true;
      }
    }
    if (global.qrcode) paintQR(); else setTimeout(paintQR, 800);
    var ta = d.querySelector('#st-share-msg'), wa = d.querySelector('[data-share="wa"]');
    ta.addEventListener('input', function () { wa.href = waHref(ta.value); });
    ta.addEventListener('change', function () {
      p.shareText = ta.value;
      store.getPage(p.id).then(function (cur) { if (cur) { cur.shareText = ta.value; return store.savePage(cur); } });
      if (state.draft && state.draft.id === p.id) state.draft.shareText = ta.value;
    });
    d.addEventListener('click', function (e) {
      if (e.target.closest('.st-close')) { d.close(); return; }
      var b = e.target.closest('[data-share]');
      if (!b) return;
      var act = b.getAttribute('data-share');
      if (act === 'copy') copyText(url, d.querySelector('.st-link-input'));
      if (act === 'qr') {
        var big = document.createElement('canvas');
        if (!drawQR(big, qrUrl, 1200)) return;
        big.toBlob(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'moranovich-' + p.slug + '-qr.png';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }, 'image/png');
      }
    });
  }

  /* ---------- events ---------- */
  app.addEventListener('input', onInput);
  app.addEventListener('change', function (e) { if (e.target.name === 'lane') onInput(e); });
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-nav],[data-mode],[data-dot]');
    if (!t) return;
    if (t.hasAttribute('data-nav')) { showList(t.getAttribute('data-nav') === 'archive'); return; }
    if (t.hasAttribute('data-mode') && t.tagName === 'BUTTON') { setMode(t.getAttribute('data-mode')); return; }
    if (t.hasAttribute('data-dot')) {
      var inp = document.getElementById(t.getAttribute('data-dot'));
      var s = inp.selectionStart != null ? inp.selectionStart : inp.value.length, en = inp.selectionEnd != null ? inp.selectionEnd : s;
      var before = inp.value.slice(0, s).replace(/\s+$/, ''), after = inp.value.slice(en).replace(/^\s+/, '');
      inp.value = before + (before ? ' · ' : '') + after;
      var pos = (before + (before ? ' · ' : '')).length;
      inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (x) {}
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act === 'new') newPageSheet();
    else if (act === 'new-base') openEditor(blankPage());
    else if (act === 'edit') store.getPage(id).then(openEditor);
    else if (act === 'dup') duplicate(id);
    else if (act === 'share') store.getPage(id).then(function (p) {
      if (p.status === 'published') shareSheet(p, false);
      else { openEditor(p); saveAndShare(); }
    });
    else if (act === 'restore') store.restorePage(id).then(function () { toast(T.tRestored); showList(true); });
    else if (act === 'back') { clearTimeout(saveTimer); autosave().then(function () { showList(); }); }
    else if (act === 'save') saveAndShare();
    else if (act === 'archive') archiveFlow();
  });

  /* ---------- boot ---------- */
  MV.ensureSprite();
  store.getBase().then(function (b) {
    base = b;
    if (MV.safeStorage.get('mv.pin')) showList(); else showGate();
  });
  MV.studio = { store: store, suggestSlug: suggestSlug, state: state };
})(window);
