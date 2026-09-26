/* ==========================================================================
   Moranovich · page.js  (public page bootstrap)
   Venue resolution, first match wins:
     1. inline <script type="application/json" id="page"> (generated /<slug>/ stubs, next milestone)
     2. location.pathname last segment        /raanana-country
     3. ?p=slug
     4. #slug (bare token, for the demo host)
   Unknown or archived slug -> base card.
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV;
  var store = MV.createStore();
  var mount = document.getElementById('mv-root');
  var current = null;

  function inlinePage() {
    var el = document.getElementById('page');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function candidates() {
    var out = [];
    var seg = global.location.pathname.split('/').filter(Boolean).pop() || '';
    seg = decodeURIComponent(seg);
    if (seg && !/\.[a-z0-9]+$/i.test(seg)) out.push(seg);
    try { var q = new URLSearchParams(global.location.search).get('p'); if (q) out.push(q); } catch (e) {}
    var h = decodeURIComponent((global.location.hash || '').slice(1));
    if (h) out.push(h);
    return out.filter(function (s) { return MV.SLUG_RE.test(s); });
  }
  function setMeta(base, venue) {
    var meta = base.meta || {};
    document.title = venue ? (venue.ogTitle || MV.defaultOgTitle(venue.venue)) : (meta.title || document.title);
    var d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', venue && venue.note ? venue.note : (meta.description || ''));
  }
  function resolve(base) {
    var inline = inlinePage();
    if (inline && inline.venue) return Promise.resolve(inline);
    var list = candidates();
    return list.reduce(function (p, slug) {
      return p.then(function (found) { return found || store.getPage(slug); });
    }, Promise.resolve(null)).then(function (pg) {
      return pg && pg.status !== 'archived' ? pg : null;
    });
  }
  function render() {
    return store.getBase().then(function (base) {
      return resolve(base).then(function (venue) {
        var key = venue ? venue.slug + '|' + venue.updatedAt : 'base';
        if (key === current) return;
        current = key;
        setMeta(base, venue);
        MV.renderPage(base, venue, mount, {});
        document.documentElement.classList.add('mv-ready');
        if (MV.track) MV.track(venue && venue.slug, 'view');
      });
    }).catch(function (e) {
      if (global.console) console.error('[page] render failed', e);
    });
  }
  global.addEventListener('hashchange', function () {
    var h = (global.location.hash || '').slice(1);
    if (!h || MV.SLUG_RE.test(h)) render();
  });
  render();
})(window);
