// Erzeugt die Bilder der Hilfe („Für Lernende“, „Für Lehrende“) und schreibt sie als WebP
// in den Block <script id="helpShots"> zwischen den Markierungen HILFE-BILDER in index.html.
//
// Aufruf:  node tools/hilfe-bilder.js [Pfad zur HTML-Datei]
// Braucht Playwright mit Chromium (wie die UI-Tests, siehe tests/README.md).
// Die App wird dafür kurz über einen lokalen Webserver ausgeliefert, damit Link und QR-Code erscheinen.
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const START = '<!-- HILFE-BILDER:START -->', END = '<!-- HILFE-BILDER:END -->';
const WIDE = 820, NARROW = 420, QUALITY = 0.8;   // Zielbreite in Pixeln, WebP-Qualität

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      // eigene Bilder nicht mitliefern: sonst wüchse der JSON-Block bei jedem Lauf
      const html = fs.readFileSync(file, 'utf8').replace(/(<script type="application\/json" id="helpShots">)[\s\S]*?(<\/script>)/, '$1{}$2');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'de-DE' });
  await ctx.addInitScript(() => { window.__KWM_TEST__ = true; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const conv = await browser.newPage();   // wandelt PNG in verkleinertes WebP um
  const shots = {};

  async function fresh(hash) {
    await page.goto('about:blank');
    await page.goto(url + (hash || ''));
    await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('kwm.coach.v1', '1'); } catch (e) {} });
    await page.goto(url + (hash || ''));
    await page.waitForTimeout(900);
    await page.evaluate(() => { document.getElementById('coach').hidden = true; });
  }
  const k = (fn, arg) => page.evaluate(fn, arg);
  async function quiet() { await page.evaluate(() => { document.getElementById('status').hidden = true; }); }
  // Kamera auf alle Atome richten; sx verschiebt das Molekül auf dem Bildschirm nach rechts (Anteil der Entfernung)
  async function frame(opts) {
    await k(o => {
      const k = window.__kwm, T = window.THREE, w = k.world;
      const c = new T.Vector3(); w.atoms.forEach(a => c.add(a.pos)); if (w.atoms.length) c.divideScalar(w.atoms.length);
      if (o.theta !== undefined) k.orbit.theta = o.theta;
      if (o.phi !== undefined) k.orbit.phi = o.phi;
      k.orbit.r = o.r || 9;
      const right = new T.Vector3(Math.cos(k.orbit.theta), 0, -Math.sin(k.orbit.theta));
      c.addScaledVector(right, -(o.sx || 0) * k.orbit.r);
      k.orbit.target.copy(c);
      k.refresh();
    }, opts);
    await page.waitForTimeout(500);
  }
  async function clear() { await k(() => { window.__kwm.clearAll(); window.__kwm.refresh(); }); }
  async function closeSide() { await k(() => { const t = document.querySelector('#side .side-tab.on'); if (t) t.click(); }); }
  async function example(id, select) {
    await k(([id, select]) => {
      const k = window.__kwm; k.addExample(id);
      if (select === 'none') { k.ui.selAtom = null; k.ui.selBond = null; }
      k.refresh();
    }, [id, select || '']);
  }
  async function rectOf(sel, pad) {
    const r = await page.$eval(sel, e => { const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; });
    pad = pad || 0;
    return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(1280, r.width + 2 * pad), height: Math.min(800, r.height + 2 * pad) };
  }
  async function shot(name, clip, maxW) {
    await page.waitForTimeout(250);
    const png = await page.screenshot({ clip: clip || { x: 0, y: 0, width: 1280, height: 800 } });
    const out = await conv.evaluate(async ([b64, maxW, q]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const s = Math.min(1, maxW / img.naturalWidth), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      return { src: c.toDataURL('image/webp', q), w, h };
    }, [png.toString('base64'), maxW || WIDE, QUALITY]);
    shots[name] = out;
    console.log(name.padEnd(14), out.w + '×' + out.h, Math.round(out.src.length / 1024) + ' KB');
  }
  const stage = () => rectOf('#stage');

  // ---------------- Für Lernende ----------------
  // Überblick mit Nummern
  await fresh();
  await clear(); await example('nh3');
  await k(() => { const k = window.__kwm; const id = k.world.atoms[0].id; k.addAtomFromPSE('O'); k.ui.selAtom = id; k.ui.selBond = null; k.refresh(); });
  await frame({ r: 10, sx: -0.04 }); await quiet();
  await k(() => {
    const pts = [['#toolbar', 1, 'tl'], ['#stage', 2, 'mid'], ['.top-actions', 3, 'tl'], ['#info', 4, 'tr'], ['.side-tabs', 5, 'tl'], ['#dock', 6, 'bl']];
    pts.forEach(([sel, n, at]) => {
      const r = document.querySelector(sel).getBoundingClientRect(), b = document.createElement('div');
      let x = r.left - 10, y = r.top - 10;
      if (at === 'mid') { x = r.left + r.width * 0.36; y = r.top + r.height * 0.24; }
      if (at === 'tr') { x = r.right - 22; y = r.top - 10; }
      if (at === 'bl') { x = r.left - 12; y = r.bottom - 22; }
      b.className = 'help-badge'; b.textContent = n;
      b.style.cssText = `position:fixed;z-index:50;left:${x}px;top:${y}px;width:28px;height:28px;border-radius:50%;background:#1b64d6;color:#fff;font:700 15px/28px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.3)`;
      document.body.appendChild(b);
    });
  });
  await shot('l-ueberblick');
  await k(() => document.querySelectorAll('.help-badge').forEach(b => b.remove()));
  await shot('l-atome', await rectOf('#dock', 6), NARROW);
  await shot('l-werkzeuge', await rectOf('#toolbar', 6), 620);
  await closeSide();

  // Verbinden: H an das O ziehen, Wolken leuchten orange
  await clear();
  const pos = await k(() => {
    const k = window.__kwm, w = k.world, T = window.THREE;
    k.addAtomFromPSE('O'); k.addAtomFromPSE('H');
    const O = w.atoms[0], H = w.atoms[1], X = new T.Vector3(1, 0, 0);
    // eine blaue Wolke des O zeigt genau nach +x, die Wolke des H nach −x: so berühren sie sich sichtbar nebeneinander
    O.pos.set(0, 0, 0); O.quat.identity(); H.pos.set(3.4, 0, 0); H.quat.identity();
    const ib = O.clouds.findIndex(c => c.occ === 1);
    O.quat.setFromUnitVectors(w.cloudDir(O, ib), X);
    H.quat.setFromUnitVectors(w.cloudDir(H, 0), X.clone().negate());
    k.ui.selAtom = null; k.refresh();
    return { H: H.id, target: [1.75, 0, 0] };
  });
  await closeSide(); await frame({ r: 6, sx: 0.1, theta: 0, phi: 1.15 }); await quiet();
  const scr = p => k(p => { const k = window.__kwm, T = window.THREE, st = document.getElementById('stage').getBoundingClientRect();
    const v = new T.Vector3().fromArray(p).project(k.R.camera); return { x: st.left + (v.x + 1) / 2 * st.width, y: st.top + (1 - v.y) / 2 * st.height }; }, p);
  const hPos = await k(id => window.__kwm.world.atom(id).pos.toArray(), pos.H);
  const a = await scr(hPos), b = await scr(pos.target);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 12, a.y + (b.y - a.y) * i / 12);
  await page.waitForTimeout(300); await quiet();
  await shot('l-verbinden', await stage());
  await page.mouse.up();

  await clear(); await example('h2o'); await frame({ r: 7, sx: 0.1 }); await quiet();
  await shot('l-wasser', await stage());

  // Bindung gewählt: O₂ mit Doppelbindung
  await clear(); await example('o2');
  await k(() => { const k = window.__kwm; k.ui.selAtom = null; k.ui.selBond = k.world.bonds[0].id; k.refresh(); });
  await frame({ r: 7, sx: 0.05 }); await quiet();
  await shot('l-bindung', await stage());

  // Infokarte zu Ammoniak
  await clear(); await example('nh3'); await frame({ r: 7, sx: 0.1 }); await quiet();
  await shot('l-infokarte', await rectOf('#info', 6), NARROW);

  // Bereich Darstellung
  await page.click('#sideToggle'); await page.waitForTimeout(300);
  await shot('l-darstellung', await rectOf('#sideBody', 6), NARROW);
  await page.click('#sideToggle');

  // Polarität beim Wasser
  await clear(); await example('h2o'); await k(() => { const k = window.__kwm; k.ui.polar = true; k.refresh(); });
  await frame({ r: 7.5, sx: 0.1 }); await quiet();
  await shot('l-polar', await stage());
  await k(() => { const k = window.__kwm; k.ui.polar = false; k.refresh(); });

  // Lewis-Formel CO₂
  await clear(); await example('co2'); await k(() => { const k = window.__kwm; k.ui.lewis = true; k.refresh(); });
  await frame({ r: 7 }); await quiet();
  await shot('l-lewis', await rectOf('#info', 6), NARROW);
  await k(() => { const k = window.__kwm; k.ui.lewis = false; k.refresh(); });

  // Beispiele
  await page.click('#btnExamples'); await page.waitForTimeout(300);
  await shot('l-beispiele', await rectOf('#ovExamples .sheet', 0));
  await page.keyboard.press('Escape');

  // Aufgabe mit Hinweis
  await fresh();
  await k(() => window.__kwm.startTask(window.KWM.Tasks.BUILTIN[0]));
  await page.click('#tcHint'); await page.click('#tcCheck');
  await closeSide(); await frame({ r: 9, sx: 0.08 }); await quiet();
  await shot('l-aufgabe', await stage());
  await page.click('#tcClose');

  // Ionen: Magnesiumchlorid
  await clear(); await example('mgcl2'); await frame({ r: 10, sx: 0.1 }); await quiet();
  await shot('l-ionen', await stage());

  // Erweitert
  await clear();
  await page.click('#tabAdv'); await page.waitForTimeout(200);
  await page.click('#tb-advanced'); await page.waitForTimeout(200); await quiet();
  await shot('l-erweitert', await rectOf('#advBody', 6), NARROW);
  await clear();
  await page.click('#advRotHelp'); await page.click('#advRotTry'); await page.click('#advRotHelp');
  await page.click('#tabAdv');
  await frame({ r: 7, sx: 0.08 }); await quiet();
  await shot('l-newman', await stage());

  // Wasserstoffbrücke zwischen zwei Wassermolekülen
  await page.click('#tabAdv'); await page.click('#tb-hbonds'); await page.click('#tabAdv');
  await k(() => {
    const k = window.__kwm, w = k.world, T = window.THREE;
    k.clearAll(); k.addExample('h2o'); k.addExample('h2o'); k.finishAnim();
    const O1 = w.atoms[0], H1 = w.atoms[1], O2 = w.atoms[3], B = w.component(O2);
    const axis = H1.pos.clone().sub(O1.pos).normalize(), lp = w.freePairs(O2)[0];
    const q = new T.Quaternion().setFromUnitVectors(w.cloudDir(O2, lp), axis.clone().negate());
    const pv = O2.pos.clone(); B.forEach(a => { a.pos.sub(pv).applyQuaternion(q).add(pv); a.quat.premultiply(q); });
    const s = H1.pos.clone().add(axis.clone().multiplyScalar(1.2)).sub(w.cloudCenter(O2, lp));
    B.forEach(a => a.pos.add(s));
    k.ui.selAtom = O1.id; k.ui.selBond = null; k.refresh();
  });
  await frame({ r: 9, sx: 0.08 }); await quiet();
  await shot('l-hbruecke', await stage());

  // ---------------- Für Lehrende ----------------
  await fresh();
  await page.click('#btnTasks'); await page.waitForTimeout(300);
  await shot('t-aufgaben', await rectOf('#ovTasks .sheet', 0));
  await page.keyboard.press('Escape');

  // Diskussionskarte mit Auflösung
  await k(() => window.__kwm.startTask(window.KWM.Tasks.DISCUSS[0]));
  await page.click('#tcReveal');
  await closeSide(); await frame({ r: 8, sx: 0.1 }); await quiet();
  await shot('t-diskussion', await stage());
  await page.click('#tcClose');

  // Editor mit übernommenem Ziel
  await clear(); await example('h2o'); await frame({ r: 7 });
  await k(() => window.__kwm.openEditor(null));
  await page.fill('#edTitle', 'Wasser: gewinkelt oder gestreckt?');
  await page.fill('#edSet', '8b Atombindung');
  await page.fill('#edText', 'Baue ein Wassermolekül und beschreibe seine Form.');
  await page.fill('#edHints', 'Sauerstoff hat zwei blaue Wolken.\nZähle auch die roten Wolken am Sauerstoff.');
  await page.click('#edTake'); await page.check('#edGeo');
  await page.waitForTimeout(200);
  await shot('t-editor', await rectOf('#ovEdit .sheet', 0));
  await page.click('#edSave'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape');

  // Teilen mit QR-Code (eigene Aufgabe aus dem Editor)
  await page.click('#btnTasks'); await page.waitForTimeout(200);
  const rows = await page.$$('#tkList .tk-row');
  const mine = rows[rows.length - 1];
  const share = await mine.$$('button.small');
  await share[1].click(); await page.waitForTimeout(500);
  const code = await page.$eval('#shCode', e => e.value);
  await shot('t-teilen', await rectOf('#ovShare .sheet', 0));
  await page.keyboard.press('Escape');

  // Aufgabe öffnen mit eingefügtem Code
  await page.click('#btnTasks'); await page.click('#tkOpen'); await page.fill('#imCode', code); await page.waitForTimeout(200);
  await shot('t-oeffnen', await rectOf('#ovImport .sheet', 0));
  await page.keyboard.press('Escape');

  // Über einen Link geöffnet: „Aufgabe behalten“
  await fresh('#aufgabe=' + code); await page.waitForTimeout(500);
  await closeSide(); await frame({ r: 9, sx: 0.08 }); await quiet();
  await shot('t-link', await stage());

  await browser.close(); srv.close();
  if (errors.length) { console.error('JS-Fehler:', errors.join(' | ')); process.exit(1); }

  // in index.html schreiben
  let html = fs.readFileSync(file, 'utf8');
  const a0 = html.indexOf(START), b0 = html.indexOf(END);
  if (a0 < 0 || b0 < a0) throw new Error('Markierungen HILFE-BILDER fehlen in ' + file);
  const json = JSON.stringify(shots).replace(/</g, '\\u003c');
  html = html.slice(0, a0) + START + '\n<script type="application/json" id="helpShots">' + json + '</script>\n' + html.slice(b0);
  fs.writeFileSync(file, html);
  const kb = Object.values(shots).reduce((s, x) => s + x.src.length, 0) / 1024;
  console.log(Object.keys(shots).length + ' Bilder, zusammen ' + Math.round(kb) + ' KB, geschrieben in ' + path.basename(file));
})().catch(e => { console.error(e); process.exit(2); });
