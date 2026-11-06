/* ============================================================
   ST. GEORGE SPIRITS — shared behaviour
   Loaded by index.html and every product page. Page-specific
   modules (hero film, back bar, barkeep) stay inline in index.html.
   ============================================================ */

/* ============================================================
   HEADER state
   ============================================================ */
(function(){
  const hdr = document.getElementById('hdr');
  if (!hdr) return;
  let ticking = false;
  function onScroll(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      hdr.classList.toggle('stuck', window.scrollY > 40);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
})();

/* ============================================================
   MOBILE NAV
   ============================================================ */
(function(){
  const hdr = document.getElementById('hdr');
  if (!hdr) return;
  const burger = hdr.querySelector('.burger');
  if (!burger) return;
  burger.setAttribute('aria-expanded','false');
  burger.addEventListener('click', function(){
    const open = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  hdr.querySelectorAll('nav.main a').forEach(function(a){
    a.addEventListener('click', function(){ hdr.classList.remove('open'); burger.setAttribute('aria-expanded','false'); });
  });

  // The dropdowns open on :hover and :focus-within, which covers mouse and
  // keyboard but leaves a touchscreen laptop with a dead menu bar — the
  // synthesised hover fires once and never clears. Make the trigger a real
  // toggle and keep aria-expanded honest for screen readers either way.
  hdr.querySelectorAll('nav.main > div').forEach(function(group){
    const btn = group.querySelector(':scope > button');
    const panel = group.querySelector(':scope > .panel');
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded','false');
    const sync = function(on){ btn.setAttribute('aria-expanded', String(on)); };
    group.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') sync(true); });
    group.addEventListener('pointerleave', function(e){ if (e.pointerType === 'mouse') sync(false); });
    group.addEventListener('focusin',  function(){ sync(true); });
    group.addEventListener('focusout', function(){ if (!group.contains(document.activeElement)) sync(false); });
    btn.addEventListener('click', function(){
      const on = group.classList.toggle('tapped');
      sync(on);
      hdr.querySelectorAll('nav.main > div.tapped').forEach(function(o){
        if (o !== group) { o.classList.remove('tapped'); const ob = o.querySelector(':scope > button'); if (ob) ob.setAttribute('aria-expanded','false'); }
      });
    });
  });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    hdr.querySelectorAll('nav.main > div.tapped').forEach(function(o){
      o.classList.remove('tapped');
      const ob = o.querySelector(':scope > button'); if (ob) ob.setAttribute('aria-expanded','false');
    });
  });
})();

/* ============================================================
   REVEAL
   ============================================================ */
(function(){
  const els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function(e){ e.classList.add('on'); }); return; }
  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(en, i){
      if (!en.isIntersecting) return;
      const el = en.target;
      const sibs = Array.prototype.slice.call(el.parentElement.children).filter(function(n){ return n.classList.contains('rv'); });
      const d = Math.max(0, sibs.indexOf(el)) * 110;
      setTimeout(function(){ el.classList.add('on'); }, d);
      io.unobserve(el);
    });
  }, { rootMargin:'0px 0px -12% 0px', threshold:.08 });
  els.forEach(function(e){ io.observe(e); });
})();

/* ============================================================
   SOUND — opt-in, and it stays opt-in.

   A saloon with no sound is a silent film, but audio that starts
   itself is the single fastest way to get a tab closed. So: the
   toggle is OFF on a first visit, the choice is remembered, and
   the click that turns it on doubles as the user gesture that
   unlocks WebAudio in the first place.

   Three layers:
     1. the hero film's own track (doors, boots, glasses) — only on
        the homepage, only while the film is running
     2. a room-tone bed that loops underneath everything after
     3. short interface sounds (glass, cork) on real interactions

   Everything routes through one GainNode so a single ramp ducks
   or kills the lot, and nothing is fetched at all until sound is
   switched on for the first time.
   ============================================================ */
window.SGSound = (function(){
  const KEY = 'sgs-sound-v1';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let on = false, ctx = null, master = null, bed = null, bedGain = null;
  let loaded = false, loading = null;
  const buffers = {};

  try { on = localStorage.getItem(KEY) === '1'; } catch(e){}

  const SOURCES = {
    room:  'assets/audio/room-tone.m4a',
    glass: 'assets/audio/glass.m4a',
    cork:  'assets/audio/cork.m4a',
    thunk: 'assets/audio/thunk.m4a'
  };

  // Product pages sit one directory down.
  const base = document.body.dataset.base || '';

  function ensureCtx(){
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function load(){
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    if (!ensureCtx()) return Promise.resolve();
    loading = Promise.all(Object.keys(SOURCES).map(function(k){
      return fetch(base + SOURCES[k])
        .then(function(r){ return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
        .then(function(ab){ return ctx.decodeAudioData(ab); })
        .then(function(buf){ buffers[k] = buf; })
        .catch(function(){ /* a missing clip must never break the page */ });
    })).then(function(){ loaded = true; });
    return loading;
  }

  function startBed(){
    if (!ctx || bed || !buffers.room) return;
    bed = ctx.createBufferSource();
    bed.buffer = buffers.room;
    bed.loop = true;
    bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    bed.connect(bedGain).connect(master);
    bed.start(0);
    bedGain.gain.linearRampToValueAtTime(.5, ctx.currentTime + 2.5);
  }

  function ramp(to, secs){
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + (secs || .6));
  }

  function play(name, vol, rate){
    if (!on || !ctx || !buffers[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = buffers[name];
    s.playbackRate.value = rate || (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = vol == null ? .7 : vol;
    s.connect(g).connect(master);
    s.start(0);
  }

  function setOn(next){
    on = !!next;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
    document.documentElement.classList.toggle('snd-on', on);
    document.querySelectorAll('[data-sound-toggle]').forEach(function(b){
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    });
    // The hero film carries the walk-in audio; everything else is WebAudio.
    const hv = document.getElementById('hv');
    if (hv) hv.muted = !on;

    if (!on) { ramp(0, .4); return; }
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    load().then(function(){
      startBed();
      ramp(1, 1.2);
    });
  }

  function mount(){
    const host = document.querySelector('.hdr-right');
    if (!host || host.querySelector('[data-sound-toggle]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snd';
    btn.setAttribute('data-sound-toggle','');
    btn.setAttribute('aria-pressed','false');
    btn.setAttribute('aria-label','Turn sound on');
    btn.innerHTML =
      '<svg width="15" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">' +
        '<path d="M1 5v4h3l4 3V2L4 5H1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path class="w1" d="M10.6 4.6a3.4 3.4 0 0 1 0 4.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
        '<path class="w2" d="M12.8 2.4a6.5 6.5 0 0 1 0 9.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
        '<path class="x" d="M11 5.2l3.6 3.6M14.6 5.2L11 8.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
      '</svg>' +
      '<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>';
    btn.addEventListener('click', function(){ setOn(!on); if (on) play('thunk', .32); });
    host.insertBefore(btn, host.firstChild);

    // Reflect the remembered choice, but do NOT resume the context here —
    // a reload is not a user gesture, so autoplay policy would reject it.
    // The first click, scroll-with-intent or keypress re-arms it below.
    document.documentElement.classList.toggle('snd-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');

    if (on) {
      const arm = function(){
        ['pointerdown','keydown','touchstart'].forEach(function(ev){
          document.removeEventListener(ev, arm);
        });
        setOn(true);
      };
      ['pointerdown','keydown','touchstart'].forEach(function(ev){
        document.addEventListener(ev, arm, { once:false, passive:true });
      });
    }
  }

  // Pause the bed when the tab is hidden — nobody wants a saloon playing
  // out of a background tab they forgot about.
  document.addEventListener('visibilitychange', function(){
    if (!on || !ctx) return;
    if (document.hidden) ramp(0, .3);
    else { if (ctx.state === 'suspended') ctx.resume(); ramp(1, .8); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  return { play: play, isOn: function(){ return on; }, set: setOn, reduce: reduce };
})();

/* ============================================================
   VIEW TRANSITIONS — the bottle is one object across two documents

   Only one element in a document may carry a given
   view-transition-name at a time, so the name is assigned to
   whichever bottle is actually involved in this navigation and
   removed as soon as the transition is over.

   `pageswap`   fires on the page being left, after the new one is
                committed — the last chance to tag the outgoing element.
   `pagereveal` fires on the page being entered, before its first
                paint — the chance to tag the incoming one.
   Browsers without these events simply navigate; nothing breaks.
   ============================================================ */
(function(){
  const NAME = 'hero-bottle';
  const KEY  = 'sgs-vt-bottle';

  function tag(el){ if (el) el.style.viewTransitionName = NAME; }
  function untag(el){ if (el) el.style.viewTransitionName = ''; }

  function productSlug(url){
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      const m = u.pathname.match(/\/spirits\/([a-z0-9-]+)\.html?$/i);
      return m ? m[1] : null;
    } catch(e){ return null; }
  }

  // Which shelf bottle (or open detail bottle) corresponds to a slug.
  function homeBottleFor(slug){
    const open = document.querySelector('.detail .face:not(.notes) img');
    if (open) return open;
    const byId = document.querySelector('.bot[data-slug="' + slug + '"] .bot-turn img');
    return byId || null;
  }

  window.addEventListener('pageswap', function(e){
    if (!e.viewTransition) return;
    const to = e.activation && e.activation.entry ? e.activation.entry.url : null;
    const slug = to ? productSlug(to) : null;

    if (slug) {                       // homepage -> product page
      try { sessionStorage.setItem(KEY, slug); } catch(err){}
      tag(homeBottleFor(slug));
    } else if (productSlug(location.href)) {   // product page -> homepage
      tag(document.querySelector('.pdp-bottle img'));
    }
  });

  window.addEventListener('pagereveal', function(e){
    if (!e.viewTransition) return;
    const here = productSlug(location.href);

    if (!here) {
      // Arriving back on the homepage: hand the name to the bottle the
      // visitor left from, then take it back so the shelf animation and
      // the detail overlay's own FLIP are not fighting over it.
      let slug = null;
      try { slug = sessionStorage.getItem(KEY); } catch(err){}
      const el = slug ? homeBottleFor(slug) : null;
      tag(el);
      e.viewTransition.finished.finally(function(){ untag(el); });
    }
    // On a product page the name is static in product.css, so there is
    // nothing to assign here.
  });
})();
