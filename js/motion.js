/* ==========================================================================
   Moranovich · motion.js
   Lottie loader + behaviours (design brief section 6).
   - lottie_light 5.12.2 from cdnjs, injected after first paint (window load).
   - Animation data from lottie/<name>.json, fetched once and cached in memory.
   - Any failure (no network, file missing, file:// fetch blocked) leaves the
     static SVG logo / plain lane numbers in place. Nothing else depends on it.
   Containers: [data-lottie="logo|lane1..4|ripple"], optional data-play.
     logo + data-play="intro"  plays the "intro" marker once (after fonts)
     logo + data-play="loop"   loops the "loop" marker while in view (footer)
     laneN                     plays once when the lane scrolls in (0.4), staggered
     ripple                    1.5s after load, then every 8s, max 3; hover/focus replays
   still:true (studio preview) or prefers-reduced-motion -> final frame only.
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV = global.MV || {};
  var LIB = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js';
  var BASE = (global.MV_LOTTIE_BASE || 'lottie/');
  var libPromise = null, dataCache = {};

  function afterLoad() {
    return new Promise(function (res) {
      if (document.readyState === 'complete') res(); else global.addEventListener('load', function () { res(); }, { once: true });
    });
  }
  function loadLib() {
    if (global.lottie) return Promise.resolve(global.lottie);
    if (libPromise) return libPromise;
    libPromise = afterLoad().then(function () {
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = LIB; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = function () { global.lottie ? res(global.lottie) : rej(new Error('no lottie')); };
        s.onerror = function () { rej(new Error('lottie lib failed')); };
        document.head.appendChild(s);
      });
    });
    libPromise.catch(function () { libPromise = null; });
    return libPromise;
  }
  function loadData(name) {
    if (!dataCache[name]) {
      dataCache[name] = fetch(BASE + name + '.json', { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error(name + ' ' + r.status);
        return r.json();
      });
      dataCache[name].catch(function () { delete dataCache[name]; });
    }
    return dataCache[name];
  }
  function marker(data, name) {
    var ms = (data && data.markers) || [];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].cm === name) return [ms[i].tm, ms[i].tm + ms[i].dr];
    }
    return null;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reduced() { return MV.prefersReducedMotion ? MV.prefersReducedMotion() : false; }

  function attach(root, opts) {
    opts = opts || {};
    var still = !!opts.still || reduced();
    var nodes = root.querySelectorAll('[data-lottie]');
    if (!nodes.length || !('fetch' in global) || !('Promise' in global)) return null;
    var anims = [], observers = [], timers = [], dead = false;

    function mount(node, data, lottie) {
      var holder = document.createElement('span');
      holder.className = 'mv-lottie';
      holder.setAttribute('aria-hidden', 'true');
      node.appendChild(holder);
      var anim = lottie.loadAnimation({
        container: holder, renderer: 'svg', loop: false, autoplay: false,
        animationData: clone(data),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: false }
      });
      anims.push(anim);
      node.classList.add('has-lottie');
      return anim;
    }
    function lastFrame(anim, seg) { anim.goToAndStop((seg ? seg[1] : anim.totalFrames) - 1, true); }

    function setup(node, lottie) {
      var name = node.getAttribute('data-lottie');
      var play = node.getAttribute('data-play') || '';
      return loadData(name).then(function (data) {
        if (dead) return;
        var anim = mount(node, data, lottie);
        var intro = marker(data, 'intro') || [0, Math.round((data.op - data.ip) / 3)];
        var loopSeg = marker(data, 'loop') || [intro[1], data.op];

        if (name === 'logo' && play === 'loop') {
          if (still) { anim.goToAndStop(loopSeg[0], true); return; }
          anim.goToAndStop(loopSeg[0], true);
          anim.loop = true;
          var io = new IntersectionObserver(function (en) {
            if (en[0].isIntersecting) anim.playSegments(loopSeg, true); else anim.pause();
          });
          io.observe(node); observers.push(io);
          return;
        }
        if (name === 'logo') {
          if (still) { lastFrame(anim, intro); return; }
          anim.goToAndStop(intro[0], true);
          var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
          fonts.then(function () { if (!dead) anim.playSegments(intro, true); });
          return;
        }
        if (/^lane\d$/.test(name)) {
          if (still) { lastFrame(anim); return; }
          anim.goToAndStop(0, true);
          // stagger by the lane's place on the page, not by the file name: the
          // four animations are mapped to the lanes they fit, not one per slot.
          var card = node.closest('.mv-lane');
          var idx = card && card.parentNode ? Array.prototype.indexOf.call(card.parentNode.children, card) : 0;
          if (idx < 0) idx = 0;
          var io2 = new IntersectionObserver(function (en) {
            if (en[0].isIntersecting) {
              timers.push(setTimeout(function () { anim.goToAndPlay(0, true); }, idx * 120));
              io2.disconnect();
            }
          }, { threshold: 0.4 });
          io2.observe(card || node); observers.push(io2);
          var lane = card;
          if (lane && global.matchMedia && global.matchMedia('(hover: hover)').matches) {
            lane.addEventListener('mouseenter', function () { if (anim.isPaused) anim.goToAndPlay(0, true); });
          }
          return;
        }
        if (name === 'ripple') {
          if (still) { anim.goToAndStop(0, true); node.classList.add('is-idle'); return; }
          anim.goToAndStop(0, true);
          var max = parseInt(getComputedStyle(root).getPropertyValue('--ripple-max-plays'), 10);
          if (isNaN(max)) max = 3;
          var plays = 0;
          node.classList.add('is-idle');
          anim.addEventListener('complete', function () { node.classList.add('is-idle'); });
          var go = function () { node.classList.remove('is-idle'); anim.goToAndPlay(0, true); };
          var fire = function () { if (dead || plays >= max) return; plays++; go(); if (plays < max) timers.push(setTimeout(fire, 8000)); };
          if (max > 0) timers.push(setTimeout(fire, 1500));
          var btn = node.parentNode && node.parentNode.querySelector('.mv-btn-wa');
          if (btn) {
            var replay = function () { if (anim.isPaused) go(); };
            btn.addEventListener('mouseenter', replay);
            btn.addEventListener('focus', replay);
          }
        }
      }).catch(function (err) {
        node.classList.add('no-lottie');
        if (global.console && console.info) console.info('[motion] static fallback for', name, err && err.message);
      });
    }

    loadLib().then(function (lottie) {
      if (dead) return;
      for (var i = 0; i < nodes.length; i++) setup(nodes[i], lottie);
    }).catch(function (err) {
      root.classList.add('no-lottie');
      if (global.console && console.info) console.info('[motion] lottie unavailable, static fallback', err && err.message);
    });

    return {
      destroy: function () {
        dead = true;
        observers.forEach(function (o) { o.disconnect(); });
        timers.forEach(clearTimeout);
        anims.forEach(function (a) { try { a.destroy(); } catch (e) {} });
      }
    };
  }

  MV.Motion = { attach: attach, loadLib: loadLib, loadData: loadData, marker: marker };
})(window);
