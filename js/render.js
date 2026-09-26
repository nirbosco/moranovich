/* ==========================================================================
   Moranovich · render.js
   The single shared renderer. Used by the public page (index.html) and by the
   studio live preview (studio.html). Plain script, exposes window.MV.

   MV.renderPage(base, venue|null, el, opts) -> controller { destroy() }
     base   content/base.json shape
     venue  a page record (slug, venue, greeting, note, details, offer, waText,
            ogTitle, lanes, heroUrl, heroVideo) or null for the base card
     el     container element; everything renders inside <div class="mv">
     opts   { preview: bool }  preview = studio pane: no sticky bar, no WebGL,
            Lottie shown on its final frame, no document-level side effects.
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV = global.MV || {};

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function get(obj, path, fallback) {
    var cur = obj;
    for (var i = 0, p = path.split('.'); i < p.length; i++) {
      if (cur == null) return fallback;
      cur = cur[p[i]];
    }
    return cur == null || cur === '' ? fallback : cur;
  }
  function waLink(phoneIntl, text) {
    return 'https://wa.me/' + encodeURIComponent(phoneIntl || '') + '?text=' + encodeURIComponent(text || '');
  }
  function defaultWaText(venueName) {
    return 'היי מורן, הגעתי מהדף של ' + venueName + ' ואשמח לשמוע על שיעורי שחייה.';
  }
  function defaultOgTitle(venueName) {
    return "מורן רבינוביץ · שחייה ב" + venueName;
  }
  function splitDetails(s) {
    return String(s || '').split(/\s*[·•|]\s*/).map(function (x) { return x.trim(); })
      .filter(Boolean).slice(0, 4);
  }
  function detailIcon(t) {
    if (/\d{1,2}:\d{2}/.test(t)) return 'clock';
    if (/^(ימי|ימים|יום|בתיאום|כל יום)/.test(t)) return 'cal';
    if (/(בריכ|אולם|מקור|קאנטרי|מתנ"ס|חוף|ים)/.test(t)) return 'pin';
    return 'dot';
  }
  function prefersReducedMotion() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function saveData() {
    var c = global.navigator && global.navigator.connection;
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
  }
  MV.esc = esc;
  MV.waLink = waLink;
  MV.defaultWaText = defaultWaText;
  MV.defaultOgTitle = defaultOgTitle;
  MV.splitDetails = splitDetails;
  MV.prefersReducedMotion = prefersReducedMotion;
  MV.saveData = saveData;

  /* ---------- SVG sprite (once per document) ---------- */
  var MONO = {
    a: 'M18 70V52a16 16 0 0 1 32 0v18',
    b: 'M50 52a16 16 0 0 1 32 0v18',
    w: 'M13 85q9.25-8 18.5 0t18.5 0t18.5 0t18.5 0'
  };
  MV.MONOGRAM_PATHS = MONO;
  function ensureSprite() {
    if (document.getElementById('mv-sprite')) return;
    var s = '<svg id="mv-sprite" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' +
      '<symbol id="mv-lg-m" viewBox="0 0 100 100">' +
        '<path d="' + MONO.a + '" fill="none" stroke="var(--c1,#7E7061)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="' + MONO.b + '" fill="none" stroke="var(--c2,#DE1B87)" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="' + MONO.w + '" fill="none" stroke="var(--c3,#92F6F8)" stroke-width="7" stroke-linecap="round"/>' +
      '</symbol>' +
      '<symbol id="mv-i-wa" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></symbol>' +
      '<symbol id="mv-i-phone" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M5.5 3.5h3l1.8 4.6-2.3 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2Z"/></symbol>' +
      '<symbol id="mv-i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></symbol>' +
      '<symbol id="mv-i-clock" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g></symbol>' +
      '<symbol id="mv-i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-6.5-5.9-6.5-11a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></g></symbol>' +
      '<symbol id="mv-i-gift" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5.5 12v8.5h13V12M12 8v12.5M12 8c-1.5-3.5-6-3.8-6-1.4C6 8 9 8 12 8Zm0 0c1.5-3.5 6-3.8 6-1.4C18 8 15 8 12 8Z"/></g></symbol>' +
      '<symbol id="mv-i-dot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" fill="currentColor"/></symbol>' +
      '<symbol id="mv-i-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></symbol>' +
      '<symbol id="mv-i-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l10.5-6.5Z"/></symbol>' +
      '</defs></svg>';
    var holder = document.createElement('div');
    holder.innerHTML = s;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  }
  MV.ensureSprite = ensureSprite;

  function icon(name, cls) {
    return '<svg class="' + (cls || 'mv-ico') + '" aria-hidden="true" focusable="false"><use href="#mv-i-' + name + '"/></svg>';
  }
  function mono(cls) {
    return '<svg class="' + (cls || 'mv-mono') + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#mv-lg-m"/></svg>';
  }
  MV.monoSvg = mono;

  /* ---------- model: merge base + venue into what the page shows ---------- */
  var CARD_DEFAULTS = {
    chipPrefix: 'במיוחד עבור', strip: 'מקצה אישי · מסלול 4', stubLabel: 'מסלול', stubNumber: '4',
    baseVenue: 'השרון והמרכז', baseNote: '', baseDetails: '', signature: 'מורן', signatureName: "מורן רבינוביץ"
  };
  function withDefaults(base) {
    var b = Object.assign({}, base || {});
    b.card = Object.assign({}, CARD_DEFAULTS, b.card || {});
    b.hero = Object.assign({ photo: 'assets/moran-coaching.webp', photoAlt: 'מורן מתקנת תנוחת זרוע לשחיינית' }, b.hero || {});
    b.contact = Object.assign({ phone: '052-3468834', phoneIntl: '972523468834' }, b.contact || {});
    return b;
  }
  MV.withDefaults = withDefaults;
  function model(base, v) {
    var isVenue = !!(v && v.venue);
    var lanesSel = (v && Array.isArray(v.lanes) && v.lanes.length) ? v.lanes.map(Number) : [1, 2, 3, 4];
    var mode = base.lanesMode === 'filter' ? 'filter' : 'mark';
    var marking = isVenue && lanesSel.length < 4 && mode === 'mark';
    var lanes = (base.lanes || []).filter(function (l) {
      return mode === 'mark' || !isVenue || lanesSel.indexOf(Number(l.id)) > -1;
    }).map(function (l) {
      return { id: l.id, title: l.title, line: l.line, avail: marking && lanesSel.indexOf(Number(l.id)) > -1 };
    });
    var venueName = isVenue ? v.venue : get(base, 'card.baseVenue', 'השרון והמרכז');
    var waText = isVenue ? (v.waText || defaultWaText(v.venue)) : get(base, 'contact.waText', '');
    return {
      isVenue: isVenue,
      venueName: venueName,
      greeting: isVenue ? (v.greeting || venueName) : venueName,
      note: isVenue ? (v.note || '') : get(base, 'card.baseNote', ''),
      details: splitDetails(isVenue ? v.details : get(base, 'card.baseDetails', '')),
      offer: isVenue ? (v.offer || '') : '',
      waText: waText,
      waHref: waLink(get(base, 'contact.phoneIntl', ''), waText),
      telHref: 'tel:+' + get(base, 'contact.phoneIntl', ''),
      photo: (isVenue && v.heroUrl) || get(base, 'hero.photo', ''),
      photoAlt: get(base, 'hero.photoAlt', ''),
      video: (isVenue && v.heroVideo) || get(base, 'hero.video', ''),
      videoPoster: (isVenue && v.heroPoster) || get(base, 'hero.videoPoster', '') || get(base, 'hero.photo', ''),
      lanes: lanes,
      marking: marking
    };
  }
  MV.pageModel = model;

  /* ---------- HTML ---------- */
  function ctaButtons(base, m, where) {
    var phone = get(base, 'contact.phone', '');
    var callLabel = String(get(base, 'contact.ctaCall', 'התקשרו')).split('·')[0].trim();
    return '' +
      '<div class="mv-cta">' +
        '<div class="mv-wa-wrap">' +
          '<span class="mv-ripple" data-lottie="ripple" aria-hidden="true"></span>' +
          '<a class="mv-btn mv-btn-wa" data-track="wa" href="' + esc(m.waHref) + '" target="_blank" rel="noopener">' +
            icon('wa') + '<span>' + esc(get(base, 'contact.ctaWhatsapp', 'כתבו לי בוואטסאפ')) + '</span></a>' +
        '</div>' +
        (where === 'hero' ?
        '<div class="mv-btn-row">' +
          '<a class="mv-btn mv-btn-call" data-track="call" href="' + esc(m.telHref) + '">' +
            '<span class="mv-call-l">' + icon('phone') + esc(callLabel) + '</span>' +
            '<bdi dir="ltr" class="mv-num">' + esc(phone) + '</bdi></a>' +
          '<a class="mv-btn mv-btn-msg" href="#mv-talk" data-scroll="mv-talk">' + esc(get(base, 'contact.ctaMessage', 'השאירו הודעה')) + '</a>' +
        '</div>' : '') +
      '</div>';
  }

  function heroMedia(m) {
    if (m.video) {
      return '<figure class="mv-pool mv-pool--video">' +
        '<video class="mv-pool-video" muted loop playsinline preload="metadata" poster="' + esc(m.videoPoster) + '" data-src="' + esc(m.video) + '" aria-label="' + esc(m.photoAlt) + '"></video>' +
        '<button type="button" class="mv-video-play" hidden aria-label="הפעלת הסרטון">' + icon('play') + '</button></figure>';
    }
    if (!m.photo) return '';
    // cutout on one aqua circle, rising out of the hero water line (.mv-water)
    return '<figure class="mv-pool"><span class="mv-pool-sun" aria-hidden="true"></span>' +
      '<img class="mv-pool-img" src="' + esc(m.photo) + '" alt="' + esc(m.photoAlt) + '" width="364" height="495" decoding="async" fetchpriority="high"></figure>';
  }

  function waves() {
    function path(y, amp) {
      var d = 'M0 ' + y + ' q50 ' + (-amp) + ' 100 0';
      for (var i = 0; i < 15; i++) d += ' t100 0';
      return d + ' V64 H0Z';
    }
    return '<div class="mv-water" aria-hidden="true">' +
      '<svg class="mv-wv mv-wv-back" viewBox="0 0 1600 64" preserveAspectRatio="none" focusable="false"><path d="' + path(24, 16) + '"/></svg>' +
      '<svg class="mv-wv mv-wv-front" viewBox="0 0 1600 64" preserveAspectRatio="none" focusable="false"><path d="' + path(34, 14) + '"/></svg>' +
    '</div>';
  }

  function noteCard(base, m) {
    if (!m.isVenue) return '';
    var chips = m.details.map(function (d) {
      return '<li class="mv-chip">' + icon(detailIcon(d)) + '<span>' + esc(d) + '</span></li>';
    }).join('');
    if (m.offer) chips += '<li class="mv-chip mv-chip-offer">' + icon('gift') + '<span>' + esc(m.offer) + '</span></li>';
    return '<section class="mv-sec mv-note-sec" aria-labelledby="mv-note-h"><div class="mv-wrap">' +
      '<article class="mv-note">' +
        '<h2 class="mv-note-title" id="mv-note-h">' + esc(m.greeting) + '</h2>' +
        (m.note ? '<p class="mv-note-text">' + esc(m.note) + '</p>' : '') +
        (chips ? '<ul class="mv-chips">' + chips + '</ul>' : '') +
        '<p class="mv-sign">' + mono('mv-mono mv-sign-mono') + '<span>' + esc(get(base, 'card.signature', 'מורן')) + '</span></p>' +
      '</article></div></section>';
  }

  function credBand(base) {
    var c = credList(base);
    if (!c.length) return '';
    return '<div class="mv-creds-band"><div class="mv-wrap"><ul class="mv-creds" aria-label="' + esc(get(base, 'credentialsLabel', 'הישגים ותפקידים')) + '">' +
      c.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>';
  }

  function rope() {
    var i = '', n = 28;
    for (var k = 0; k < n; k++) i += '<i></i>';
    return '<div class="mv-rope" aria-hidden="true">' + i + '</div>';
  }

  function lanesSec(base, m) {
    var items = m.lanes.map(function (l) {
      return '<li class="mv-lane' + (l.avail ? ' is-avail' : '') + (m.marking && !l.avail ? ' is-dim' : '') + '">' +
        '<div class="mv-lane-head"><span class="mv-lane-num">' + esc(l.id) + '</span>' +
          '<span class="mv-lane-ico" data-lottie="lane' + esc(l.id) + '" aria-hidden="true"></span></div>' +
        '<div class="mv-lane-body"><h3>' + esc(l.title) + '</h3><p>' + esc(l.line) + '</p>' +
          (l.avail ? '<span class="mv-tag">' + icon('check') + esc(base.laneAvailable || 'זמין אצלכם') + '</span>' : '') +
        '</div></li>';
    }).join('');
    return '<section class="mv-sec" aria-labelledby="mv-lanes-h"><div class="mv-wrap">' +
      '<h2 class="mv-h2" id="mv-lanes-h">' + esc(base.lanesTitle || 'ארבעה מסלולים') + '</h2>' +
      '<ol class="mv-lanes">' + items + '</ol>' +
      (base.lanesClosing ? '<p class="mv-lanes-close">' + esc(base.lanesClosing) + '</p>' : '') + '</div></section>';
  }

  function credList(base) {
    var c = base.credentials;
    if (typeof c === 'string') c = c.split(/\s*·\s*/);
    if (!Array.isArray(c)) c = [];
    return c.map(function (x) { return typeof x === 'string' ? x : (x && (x.text || x.title)) || ''; })
      .map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, 6);
  }
  MV.credList = credList;

  function aboutSec(base) {
    var a = base.about || {};
    var creds = [];
    var photo = a.photo ? '<figure class="mv-about-photo"><img src="' + esc(a.photo) + '" alt="' + esc(a.photoAlt || '') + '" loading="lazy"></figure>' : '';
    var band = creds.length ? '<ul class="mv-creds" aria-label="' + esc(a.credentialsLabel || 'הישגים ותפקידים') + '">' +
      creds.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '';
    if (!a.title && !a.text && !band) return '';
    return '<section class="mv-sec" aria-labelledby="mv-about-h"><div class="mv-wrap mv-about' + (band ? ' has-creds' : '') + (photo ? ' has-photo' : '') + '">' +
      '<div class="mv-about-text"><h2 class="mv-h2" id="mv-about-h">' + esc(a.title || 'קצת עליי') + '</h2>' +
      (a.text ? '<p class="mv-about-p">' + esc(a.text) + '</p>' : '') + '</div>' + band + photo + '</div></section>';
  }

  function talkSec(base, m) {
    var f = base.form || {}, fl = f.fields || {};
    var opts = (get(fl, 'lane.options', []) || []).map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
    function lab(k) { return esc(get(fl, k + '.label', '')); }
    function ph(k) { return esc(get(fl, k + '.placeholder', '')); }
    return '<section class="mv-sec mv-talk" id="mv-talk" aria-labelledby="mv-talk-h"><div class="mv-wrap mv-talk-in">' +
      '<div class="mv-talk-head"><h2 class="mv-h2" id="mv-talk-h">' + esc(f.title || 'נדבר?') + '</h2>' +
        '<p class="mv-lead-s">' + esc(f.subtitle || '') + '</p>' + ctaButtons(base, m, 'talk') + '</div>' +
      '<form class="mv-form" novalidate>' +
        '<div class="mv-field"><label for="mv-f-name">' + lab('name') + '</label><input id="mv-f-name" name="name" autocomplete="name" placeholder="' + ph('name') + '"><p class="mv-err" hidden></p></div>' +
        '<div class="mv-field"><label for="mv-f-phone">' + lab('phone') + '</label><input id="mv-f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="' + ph('phone') + '"><p class="mv-err" hidden></p></div>' +
        '<div class="mv-field"><label for="mv-f-lane">' + lab('lane') + '</label><select id="mv-f-lane" name="lane"><option value="">' + ph('lane') + '</option>' + opts + '</select><p class="mv-err" hidden></p></div>' +
        (fl.place ? '<div class="mv-field"><label for="mv-f-place">' + lab('place') + '</label><input id="mv-f-place" name="place" autocomplete="off" placeholder="' + ph('place') + '"' + (m.isVenue ? ' value="' + esc(m.venueName) + '"' : '') + '></div>' : '') +
        '<div class="mv-field"><label for="mv-f-msg">' + lab('message') + '</label><textarea id="mv-f-msg" name="message" rows="3" placeholder="' + ph('message') + '"></textarea></div>' +
        '<button class="mv-btn mv-btn-send" type="submit">' + esc(f.submit || 'שליחה') + '</button>' +
      '</form></div></section>';
  }

  function footer(base) {
    var ft = base.footer || {};
    var l2 = String(ft.line2 || '').split('·').map(function (x) { return '<bdi dir="ltr">' + esc(x.trim()) + '</bdi>'; }).join(' · ');
    return '<footer class="mv-foot"><div class="mv-wrap mv-foot-in">' +
      '<div class="mv-foot-lock"><span class="mv-foot-badge" data-lottie="logo" data-play="loop">' + mono('mv-mono mv-static') + '</span>' +
        '<span class="mv-foot-wm"><b>' + esc(get(base, 'hero.name', '')) + '</b><span>' + esc(get(base, 'hero.role', '')) + '</span></span></div>' +
      '<p class="mv-foot-l1">' + esc(ft.line1 || '') + '</p>' +
      '<p class="mv-foot-l2 mv-num">' + l2 + '</p>' +
      '<p class="mv-foot-c" lang="en" dir="ltr">' + esc(ft.copyright || '') + '</p>' +
    '</div></footer>';
  }

  function stickyBar(base, m) {
    return '<div class="mv-sticky" aria-hidden="true" data-state="off">' +
      '<div class="mv-sticky-in">' +
        '<span class="mv-sticky-brand">' + mono('mv-mono') + '<span lang="en">MORANOVICH</span></span>' +
        '<a class="mv-btn mv-btn-wa mv-sticky-wa" data-track="wa" tabindex="-1" href="' + esc(m.waHref) + '" target="_blank" rel="noopener">' + icon('wa') + '<span>' + esc(get(base, 'contact.ctaWhatsapp', '')) + '</span></a>' +
        '<a class="mv-sticky-call" data-track="call" tabindex="-1" href="' + esc(m.telHref) + '" aria-label="' + esc(String(get(base, 'contact.ctaCall', 'התקשרו'))) + '">' + icon('phone') + '</a>' +
      '</div></div>';
  }

  function pageHtml(base, m, opts) {
    var h = base.hero || {};
    var chip = m.isVenue ?
      '<p class="mv-venue-chip"><i aria-hidden="true"></i>' + esc(get(base, 'card.chipPrefix', 'במיוחד עבור')) + ' ' + esc(m.venueName) + '</p>' :
      '<p class="mv-area"><i aria-hidden="true"></i>' + esc(h.area || '') + '</p>';
    var areaUnder = m.isVenue && h.area ? '<p class="mv-area-s">' + esc(h.area) + '</p>' : '';
    return '' +
      '<div class="mv-page' + (opts.preview ? ' is-preview' : '') + '">' +
      '<section class="mv-hero" aria-labelledby="mv-name">' +
        '<div class="mv-caustics" aria-hidden="true"><canvas class="mv-caustics-c"></canvas></div>' +
        '<div class="mv-veil" aria-hidden="true"></div>' +
        '<header class="mv-bar"><div class="mv-wrap mv-bar-in">' + mono('mv-mono') + '<span class="mv-bar-wm" lang="en">MORANOVICH</span></div></header>' +
        '<div class="mv-wrap mv-hero-in">' +
          '<div class="mv-hero-text">' +
            '<span class="mv-lane-line" aria-hidden="true"></span>' +
            '<div class="mv-logo" data-lottie="logo" data-play="intro" aria-hidden="true">' + mono('mv-mono mv-static') + '</div>' +
            chip +
            '<h1 class="mv-name" id="mv-name">' + esc(h.name || '') + '</h1>' +
            '<p class="mv-role">' + esc(h.role || '') + '</p>' + areaUnder +
            '<p class="mv-lead">' + esc(h.lead || '') + '</p>' +
            ctaButtons(base, m, 'hero') +
          '</div>' +
          heroMedia(m) +
        '</div>' +
        waves() +
      '</section>' +
      credBand(base) +
      noteCard(base, m) +
      rope() +
      lanesSec(base, m) +
      aboutSec(base) +
      talkSec(base, m) +
      footer(base) +
      (opts.preview ? '' : stickyBar(base, m)) +
      '</div>';
  }

  /* ---------- behaviour ---------- */
  function wireForm(root, base, m) {
    var form = root.querySelector('.mv-form');
    if (!form) return;
    var errs = get(base, 'form.errors', {});
    function setErr(input, msg) {
      var p = input.parentNode.querySelector('.mv-err');
      if (!p) return;
      p.hidden = !msg; p.textContent = msg || '';
      if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', input.id + '-e'); p.id = input.id + '-e'; }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name, phone = form.elements.phone, lane = form.elements.lane, msg = form.elements.message;
      var digits = phone.value.replace(/\D/g, '');
      var first = null;
      setErr(name, name.value.trim() ? '' : errs.nameRequired); if (!name.value.trim()) first = first || name;
      var pErr = !digits ? errs.phoneRequired : (digits.length !== 10 ? errs.phoneInvalid : '');
      setErr(phone, pErr); if (pErr) first = first || phone;
      setErr(lane, lane.value ? '' : errs.laneRequired); if (!lane.value) first = first || lane;
      if (first) { first.focus(); return; }
      var labels = get(base, 'form.fields', {});
      var text = m.waText + '\n' +
        get(labels, 'name.label', 'שם') + ': ' + name.value.trim() + '\n' +
        get(labels, 'phone.label', 'טלפון') + ': ' + phone.value.trim() + '\n' +
        lane.value +
        (form.elements.place && form.elements.place.value.trim() ? '\nהבריכה: ' + form.elements.place.value.trim() : '') +
        (msg.value.trim() ? '\n' + msg.value.trim() : '');
      var href = waLink(get(base, 'contact.phoneIntl', ''), text);
      var w = null;
      try { w = global.open(href, '_blank', 'noopener'); } catch (err) { w = null; }
      if (!w) global.location.href = href;
    });
  }

  function wireScroll(root) {
    root.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-scroll]');
      if (!a) return;
      var t = root.querySelector('#' + a.getAttribute('data-scroll'));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      var first = t.querySelector('input,select,textarea');
      if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (x) { first.focus(); } }, prefersReducedMotion() ? 0 : 450);
    });
  }

  function wireVideo(root) {
    var v = root.querySelector('.mv-pool-video');
    if (!v) return;
    var btn = root.querySelector('.mv-video-play');
    var auto = !prefersReducedMotion() && !saveData();
    function start() { if (!v.src) v.src = v.getAttribute('data-src'); var p = v.play(); if (p && p.catch) p.catch(function () { btn.hidden = false; }); btn.hidden = true; }
    if (auto) { v.autoplay = true; start(); }
    else btn.hidden = false;
    btn.addEventListener('click', start);
  }

  function wireSticky(root, cleanups) {
    var bar = root.querySelector('.mv-sticky');
    var hero = root.querySelector('.mv-hero');
    var talk = root.querySelector('.mv-talk');
    if (!bar || !hero || !('IntersectionObserver' in global)) return;
    var heroVisible = true, talkVisible = false;
    function update() {
      var on = !heroVisible && !talkVisible;
      bar.setAttribute('data-state', on ? 'on' : 'off');
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
      var links = bar.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) links[i].tabIndex = on ? 0 : -1;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.target === hero) heroVisible = en.isIntersecting;
        if (en.target === talk) talkVisible = en.isIntersecting;
      });
      update();
    }, { threshold: 0, rootMargin: '0px 0px -30% 0px' });
    io.observe(hero); if (talk) io.observe(talk);
    cleanups.push(function () { io.disconnect(); });
  }

  function wireTracking(root, venue) {
    // Next milestone: SupabaseStore.hit(slug, kind, src). For now a no-op hook.
    root.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-track]');
      if (a && MV.track) MV.track(venue && venue.slug, a.getAttribute('data-track'));
    });
  }

  MV.renderPage = function (base, venue, el, opts) {
    opts = opts || {};
    ensureSprite();
    base = withDefaults(base);
    var m = model(base, venue);
    var root = el.querySelector(':scope > .mv');
    if (!root) {
      root = document.createElement('div');
      root.className = 'mv';
      root.setAttribute('dir', 'rtl');
      root.setAttribute('lang', 'he');
      el.innerHTML = '';
      el.appendChild(root);
    }
    if (root._mvCtl) root._mvCtl.destroy();
    root.innerHTML = pageHtml(base, m, opts);

    var cleanups = [];
    wireForm(root, base, m);
    wireScroll(root);
    if (!opts.preview) {
      wireVideo(root);
      wireSticky(root, cleanups);
      wireTracking(root, venue);
      if (MV.Caustics) {
        var c = MV.Caustics.start(root.querySelector('.mv-hero'), root.querySelector('.mv-caustics-c'));
        if (c) cleanups.push(c.destroy);
      }
    } else {
      var pv = root.querySelector('.mv-pool-video');
      if (pv) { pv.src = pv.getAttribute('data-src'); }
    }
    if (MV.Motion) {
      var mo = MV.Motion.attach(root, { still: !!opts.preview });
      if (mo) cleanups.push(mo.destroy);
    }
    var ctl = {
      root: root,
      model: m,
      destroy: function () { cleanups.forEach(function (f) { try { f(); } catch (e) {} }); cleanups = []; }
    };
    root._mvCtl = ctl;
    return ctl;
  };
})(window);
