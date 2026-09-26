/* ==========================================================================
   Moranovich · store.js
   Data adapter. The public page and the studio only talk to this interface:

     getBase()                -> Promise<base>
     saveBase(base)           -> Promise<base>
     listPages({archived})    -> Promise<page[]>   newest first
     getPage(idOrSlug)        -> Promise<page|null>
     savePage(page)           -> Promise<page>     rejects {code:'slug_taken'|'slug_invalid'}
     duplicatePage(id)        -> Promise<page>     new draft, free slug
     publishPage(id)          -> Promise<page>     status 'published', slug locked
     archivePage(id)          -> Promise<page>
     restorePage(id)          -> Promise<page>

   Page record:
     { id, slug, venue, greeting, note, details, offer, waText, ogTitle,
       lanes:[1..4], heroUrl, heroVideo, shareText, status:'draft'|'published'|'archived',
       clonedFrom, createdAt, updatedAt, publishedAt }

   LocalStore  this milestone: localStorage (try/catch, falls back to memory),
               seeded from content/*.json, or from js/seed.js when fetch is blocked.
   SupabaseStore  next milestone, documented stub below.
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV = global.MV || {};
  var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  MV.SLUG_RE = SLUG_RE;

  function now() { return new Date().toISOString(); }
  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  /* ---------- safe storage ---------- */
  var mem = {};
  var LS = {
    get: function (k) {
      try { var v = global.localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : null) : v; }
      catch (e) { return k in mem ? mem[k] : null; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; }
    }
  };
  MV.safeStorage = LS;

  /* ---------- seed ---------- */
  function fetchJson(url) {
    if (!('fetch' in global)) return Promise.reject(new Error('no fetch'));
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function loadSeed(contentBase) {
    var fallback = global.MV_SEED || { base: {}, pages: [] };
    return Promise.all([
      fetchJson(contentBase + 'base.json').catch(function () { return clone(fallback.base); }),
      fetchJson(contentBase + 'examples.json').catch(function () { return clone(fallback.pages); })
    ]).then(function (r) { return { base: r[0], pages: r[1] }; });
  }
  function seedPages(list) {
    var t = Date.parse('2026-09-20T09:00:00Z');
    return (list || []).map(function (p, i) {
      var stamp = new Date(t + i * 36e5 * 20).toISOString();
      return Object.assign({
        id: 'seed-' + p.slug, heroUrl: '', heroVideo: '', shareText: '',
        status: i === 3 ? 'draft' : 'published', clonedFrom: null,
        createdAt: stamp, updatedAt: stamp, publishedAt: i === 3 ? null : stamp
      }, clone(p));
    });
  }

  /* ---------- LocalStore ---------- */
  function LocalStore(opts) {
    opts = opts || {};
    this.key = opts.key || 'mv.v4'; // bump when the seed schema changes
    this.contentBase = opts.contentBase || 'content/';
    this._ready = null;
  }
  LocalStore.prototype._load = function () {
    var self = this;
    if (self._ready) return self._ready;
    self._ready = loadSeed(self.contentBase).then(function (seed) {
      var raw = LS.get(self.key), db = null;
      try { db = raw ? JSON.parse(raw) : null; } catch (e) { db = null; }
      if (!db || !Array.isArray(db.pages)) db = { pages: seedPages(seed.pages), base: null, v: 1 };
      self._seedBase = seed.base;
      self._db = db;
      self._persist();
      return db;
    });
    return self._ready;
  };
  LocalStore.prototype._persist = function () { LS.set(this.key, JSON.stringify(this._db)); };
  LocalStore.prototype._find = function (idOrSlug) {
    var p = this._db.pages;
    for (var i = 0; i < p.length; i++) if (p[i].id === idOrSlug || p[i].slug === idOrSlug) return p[i];
    return null;
  };
  LocalStore.prototype.getBase = function () {
    var self = this;
    return this._load().then(function () {
      // base edits are a v2 feature; a saved override wins over the seed
      return clone(self._db.base || self._seedBase);
    });
  };
  LocalStore.prototype.saveBase = function (base) {
    var self = this;
    return this._load().then(function () { self._db.base = clone(base); self._persist(); return clone(base); });
  };
  LocalStore.prototype.listPages = function (o) {
    var self = this; o = o || {};
    return this._load().then(function () {
      return clone(self._db.pages.filter(function (p) { return o.archived ? p.status === 'archived' : p.status !== 'archived'; })
        .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); }));
    });
  };
  LocalStore.prototype.getPage = function (idOrSlug) {
    var self = this;
    return this._load().then(function () { return clone(self._find(idOrSlug)); });
  };
  LocalStore.prototype.slugFree = function (slug, exceptId) {
    var self = this;
    return this._load().then(function () {
      return !self._db.pages.some(function (p) { return p.slug === slug && p.id !== exceptId; });
    });
  };
  LocalStore.prototype.freeSlug = function (slug, exceptId) {
    var self = this;
    return this._load().then(function () {
      var base = (slug || 'page').replace(/-\d+$/, ''), s = slug || 'page', n = 2;
      while (self._db.pages.some(function (p) { return p.slug === s && p.id !== exceptId; })) s = base + '-' + (n++);
      return s;
    });
  };
  LocalStore.prototype.savePage = function (page) {
    var self = this;
    return this._load().then(function () {
      if (!page.slug || !SLUG_RE.test(page.slug)) throw err('slug_invalid');
      var existing = page.id ? self._find(page.id) : null;
      if (existing && existing.publishedAt && existing.slug !== page.slug) throw err('slug_locked');
      if (self._db.pages.some(function (p) { return p.slug === page.slug && p.id !== page.id; })) throw err('slug_taken');
      var rec = Object.assign({}, existing || { id: page.id || uid(), status: 'draft', createdAt: now(), publishedAt: null }, clone(page));
      rec.updatedAt = now();
      if (existing) self._db.pages[self._db.pages.indexOf(existing)] = rec; else self._db.pages.push(rec);
      self._persist();
      return clone(rec);
    });
  };
  LocalStore.prototype.duplicatePage = function (id) {
    var self = this;
    return this._load().then(function () {
      var src = self._find(id);
      if (!src) throw err('not_found');
      return self.freeSlug(src.slug + '-2').then(function (slug) {
        var rec = Object.assign(clone(src), {
          id: uid(), slug: slug, status: 'draft', clonedFrom: src.id,
          createdAt: now(), updatedAt: now(), publishedAt: null
        });
        self._db.pages.push(rec); self._persist();
        return clone(rec);
      });
    });
  };
  LocalStore.prototype._setStatus = function (id, status) {
    var self = this;
    return this._load().then(function () {
      var p = self._find(id); if (!p) throw err('not_found');
      p.status = status; p.updatedAt = now();
      if (status === 'published' && !p.publishedAt) p.publishedAt = now();
      self._persist(); return clone(p);
    });
  };
  LocalStore.prototype.publishPage = function (id) { return this._setStatus(id, 'published'); };
  LocalStore.prototype.archivePage = function (id) { return this._setStatus(id, 'archived'); };
  LocalStore.prototype.restorePage = function (id) {
    var self = this;
    return this._load().then(function () {
      var p = self._find(id); if (!p) throw err('not_found');
      return self._setStatus(id, p.publishedAt ? 'published' : 'draft');
    });
  };
  LocalStore.prototype.reset = function () { this._db = { pages: [], base: null }; LS.set(this.key, ''); this._ready = null; };

  /* ---------- SupabaseStore (next milestone, NOT wired) ----------
     Matches 01-technical-brief.md appendix:
       project ref joyerclvkexbutbalfxb, tables mv_admin / mv_pages / mv_hits (RLS on, no anon table access)
       rpc mv_admin_op(pin text, op text, payload jsonb)
           ops: list | get | save | clone | archive | restore | stats | set_pin
           bcrypt via pgcrypto crypt(); 5 wrong PINs -> 10 minute lock
       rpc mv_hit(slug text, kind text, src text)      anon, kind: view|wa|call|sms, src: link|qr
       edge function mv-publish {pin, page_id, og_jpeg_base64} -> commits /<slug>/index.html + og-<v>.jpg
       edge function mv-publish-base {pin, base}
     Column mapping page <-> mv_pages:
       venue->venue_name, greeting->headline, note->message, details->details_line,
       offer->offer, waText->wa_text, heroUrl->hero_url, lanes->lanes, status, published_at
       (ogTitle and shareText need two extra text columns: og_title, share_text)
     The PIN lives in localStorage ('mv.pin') after the gate; every call sends it.
  */
  function SupabaseStore(cfg) {
    this.url = cfg && cfg.url;          // https://joyerclvkexbutbalfxb.supabase.co
    this.anonKey = cfg && cfg.anonKey;  // public anon key
    this.pin = cfg && cfg.pin;
  }
  SupabaseStore.prototype._rpc = function (fn, args) {
    return fetch(this.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: this.anonKey, Authorization: 'Bearer ' + this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw err(j.code || 'rpc_failed', j.message); return j; }); });
  };
  SupabaseStore.prototype._op = function (op, payload) { return this._rpc('mv_admin_op', { pin: this.pin, op: op, payload: payload || {} }); };
  function todo(name) { return function () { return Promise.reject(err('not_implemented', 'SupabaseStore.' + name + ' arrives next milestone')); }; }
  SupabaseStore.prototype.getBase = todo('getBase');         // GET /content/base.json from the site
  SupabaseStore.prototype.saveBase = todo('saveBase');       // edge fn mv-publish-base
  SupabaseStore.prototype.listPages = todo('listPages');     // _op('list', {archived})
  SupabaseStore.prototype.getPage = todo('getPage');         // _op('get', {id|slug})
  SupabaseStore.prototype.savePage = todo('savePage');       // _op('save', page)
  SupabaseStore.prototype.duplicatePage = todo('duplicatePage'); // _op('clone', {id})
  SupabaseStore.prototype.publishPage = todo('publishPage'); // edge fn mv-publish
  SupabaseStore.prototype.archivePage = todo('archivePage'); // _op('archive', {id})
  SupabaseStore.prototype.restorePage = todo('restorePage'); // _op('restore', {id})
  SupabaseStore.prototype.hit = function (slug, kind, src) { // public counter, fire and forget
    try {
      var body = JSON.stringify({ slug: slug, kind: kind, src: src || 'link' });
      fetch(this.url + '/rest/v1/rpc/mv_hit', { method: 'POST', keepalive: true, body: body,
        headers: { apikey: this.anonKey, Authorization: 'Bearer ' + this.anonKey, 'Content-Type': 'application/json' } });
    } catch (e) {}
  };

  MV.LocalStore = LocalStore;
  MV.SupabaseStore = SupabaseStore;
  MV.createStore = function (opts) { return new LocalStore(opts); };
})(window);
