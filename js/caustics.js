/* ==========================================================================
   Moranovich · caustics.js
   Pool-floor light pattern for the hero. One hand-written fragment shader:
   two layers of animated cell borders (F2-F1), domain-warped by slow sines,
   tinted with the caustics tokens from tokens.css. A tap releases one ripple.
   Budget: 30fps cap, render scale from --caustics-res-mobile, DPR <= 1.5,
   paused offscreen (IntersectionObserver) and when the tab is hidden.
   Skipped entirely on prefers-reduced-motion, Save-Data or no WebGL: the CSS
   poster under the canvas stays (see .mv-caustics in page.css).
   ========================================================================== */
(function (global) {
  'use strict';
  var MV = global.MV = global.MV || {};

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform vec2 uR;uniform float uT,uS,uCell;uniform vec3 uTop,uBot,uTr,uLi,uTi;uniform float uTa;uniform vec3 uRip;',
    'vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}',
    'float cell(vec2 p,float t){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;',
    ' for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=h2(i+g);',
    '  o=.5+.42*sin(t+6.2831*o);float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}}',
    ' return d2-d1;}',
    'void main(){',
    ' vec2 px=gl_FragCoord.xy/uS;vec2 uv=gl_FragCoord.xy/uR;',
    ' vec2 p=px/uCell;',
    ' float rt=uT-uRip.z;if(rt>0.&&rt<4.){vec2 dv=px-uRip.xy;float d=length(dv);',
    '  float w=sin(d*.09-rt*7.)*exp(-d*.012)*exp(-rt*1.1);p+=normalize(dv+.001)*w*.22;}',
    ' p+=.28*vec2(sin(p.y*1.7+uT*.9),cos(p.x*1.4-uT*.8));',
    ' float a=cell(p,uT);float b=cell(p*1.63+vec2(3.1,1.7),uT*1.25+1.3);',
    ' float l=pow(1.-smoothstep(0.,.2,a),3.)*.85+pow(1.-smoothstep(0.,.14,b),3.)*.5;',
    ' vec3 c=mix(uBot,uTop,uv.y);',
    ' c=mix(c,uTr,.55*smoothstep(.25,.7,a));',
    ' c=mix(c,uTi,clamp(l*1.3,0.,1.)*uTa);',
    ' c=mix(c,uLi,clamp(l*l*1.5,0.,1.)*.9);',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function cssVar(el, name, fallback) {
    var v = '';
    try { v = getComputedStyle(el).getPropertyValue(name).trim(); } catch (e) {}
    return v || fallback;
  }
  function parseColor(s) {
    s = String(s).trim();
    var m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(s))) {
      var n = parseInt(m[1], 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
    }
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
      return [0, 1, 2].map(function (i) { return parseInt(m[1][i] + m[1][i], 16) / 255; }).concat([1]);
    }
    if ((m = /rgba?\(([^)]+)\)/i.exec(s))) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
    }
    return null;
  }

  function supported() {
    if (MV.prefersReducedMotion && MV.prefersReducedMotion()) return false;
    if (MV.saveData && MV.saveData()) return false;
    return true;
  }

  function start(hero, canvas) {
    if (!hero || !canvas || !supported()) return null;
    var gl = null;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' }); } catch (e) {}
    if (!gl) return null;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      if (global.console) console.warn('[caustics] shader failed, keeping poster', err);
      return null;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uR', 'uT', 'uS', 'uCell', 'uTop', 'uBot', 'uTr', 'uLi', 'uTi', 'uTa', 'uRip'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    function c3(name, fb) { var c = parseColor(cssVar(hero, name, fb)) || parseColor(fb); return c; }
    var top = c3('--caustics-floor-top', '#F3FEFE'), bot = c3('--caustics-floor-bottom', '#E6FDFD'),
      tr = c3('--caustics-trough', '#C9FAFB'), li = c3('--caustics-light', '#FFFFFF'),
      ti = c3('--caustics-tint', 'rgba(146,246,248,.55)');
    var speed = parseFloat(cssVar(hero, '--caustics-speed', '0.15')) || 0.15;
    gl.uniform3f(U.uTop, top[0], top[1], top[2]);
    gl.uniform3f(U.uBot, bot[0], bot[1], bot[2]);
    gl.uniform3f(U.uTr, tr[0], tr[1], tr[2]);
    gl.uniform3f(U.uLi, li[0], li[1], li[2]);
    gl.uniform3f(U.uTi, ti[0], ti[1], ti[2]);
    gl.uniform1f(U.uTa, ti[3]);
    gl.uniform3f(U.uRip, -999, -999, -99);

    var scale = 1, W = 0, H = 0;
    function resize() {
      var r = hero.getBoundingClientRect();
      var res = parseFloat(cssVar(hero, '--caustics-res-mobile', '0.5')) || 0.5;
      var dprMax = parseFloat(cssVar(hero, '--caustics-dpr-max', '1.5')) || 1.5;
      scale = res * Math.min(global.devicePixelRatio || 1, dprMax);
      W = Math.max(1, Math.round(r.width * scale)); H = Math.max(1, Math.round(r.height * scale));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uR, W, H);
      gl.uniform1f(U.uS, scale);
      gl.uniform1f(U.uCell, r.width < 700 ? 92 : 128); // css px per light cell
    }

    var t0 = performance.now(), last = 0, raf = 0, visible = true, running = false, shown = false, clock = 0, prev = 0;
    function frame(now) {
      raf = global.requestAnimationFrame(frame);
      if (now - last < 32) return; // ~30fps cap
      var dt = prev ? Math.min(now - prev, 100) : 0; prev = now; last = now;
      clock += dt / 1000;
      gl.uniform1f(U.uT, clock * speed * 3.5 + 7.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.classList.add('is-on'); }
    }
    function play() { if (!running && visible && !document.hidden) { running = true; prev = 0; raf = global.requestAnimationFrame(frame); } }
    function pause() { running = false; global.cancelAnimationFrame(raf); }

    resize();
    var ro = ('ResizeObserver' in global) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(hero); else global.addEventListener('resize', resize);
    var io = ('IntersectionObserver' in global) ? new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting; if (visible) play(); else pause();
    }) : null;
    if (io) io.observe(hero);
    function onVis() { if (document.hidden) pause(); else play(); }
    document.addEventListener('visibilitychange', onVis);

    // tap on open water releases one gentle ripple
    function onTap(e) {
      if (e.target.closest && e.target.closest('a,button,input,select,textarea,.mv-pool')) return;
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left), y = (r.bottom - e.clientY);
      gl.uniform3f(U.uRip, x, y, clock * speed * 3.5 + 7.0);
    }
    hero.addEventListener('pointerdown', onTap);

    play();
    return {
      destroy: function () {
        pause();
        if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        hero.removeEventListener('pointerdown', onTap);
        var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      }
    };
  }

  MV.Caustics = { start: start };
})(window);
