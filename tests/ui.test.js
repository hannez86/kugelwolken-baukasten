// Browser-Test der Oberfläche (Playwright, Chromium headless).
// Aufruf: node tests/ui.test.js [HTML-Datei] [Ordner für Screenshots]
// Playwright wird normal per require gesucht; sonst Pfad in PLAYWRIGHT_MODULE angeben (siehe tests/README.md).
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const out = process.argv[3] || null;
const shot = (page, name, opts) => out ? page.screenshot(Object.assign({ path: path.join(out, name) }, opts)) : Promise.resolve();
if (out) fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.__KWM_TEST__ = true; try { if (!sessionStorage.getItem('t')) { localStorage.clear(); sessionStorage.setItem('t', '1'); } } catch (e) {} });
  await page.goto(file);
  await page.waitForTimeout(800);
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEHLER: ') + m); if (!c) fails++; };
  const info = () => page.$eval('#info', e => e.textContent);
  const vis = sel => page.$eval(sel, e => !e.hidden && e.offsetParent !== null);
  // Seitenleiste rechts mit den Bereichen „Darstellung“, „Atome“ und „Erweitert“: öffnen, falls zu
  const openView = async () => { if (await page.$eval('#sideBody', e => e.hidden)) await page.click('#sideToggle'); };
  const openPse = async () => { if (await page.$eval('#dock', e => e.hidden)) await page.click('#tabPse'); };
  const openAdv = async () => { if (await page.$eval('#advBody', e => e.hidden)) await page.click('#tabAdv'); };
  const usable = sel => page.$eval(sel, e => !e.hidden && !e.disabled && e.offsetParent !== null);

  // Seitenleiste: beim ersten Start ist „Atome“ offen, höchstens ein Bereich offen
  ok(await vis('#dock') && !(await vis('#sideBody')) && !(await vis('#advBody')), 'Seitenleiste: anfangs Atome offen, Darstellung und Erweitert zu');
  await page.click('#sideToggle');
  ok(await vis('#sideBody') && !(await vis('#dock')), 'Seitenleiste: Darstellung öffnet, Atome klappt zu');
  ok(!!(await page.$('#sideList #tb-labels')) && !(await page.$('#tbg-view')), 'Darstellungs-Schalter in der Seitenleiste, kein eigenes Menü');
  ok(!!(await page.$('.menu #tb-spin')) && !(await page.$('#sideList #tb-spin')), '„Ansicht kreisen lassen“ im Menü „Ansicht“');
  await page.click('#tabAdv');
  ok(await vis('#advBody') && !(await vis('#sideBody')), 'Seitenleiste: Erweitert öffnet, Darstellung klappt zu');
  ok(!!(await page.$('#advBody #btnProton')) && !!(await page.$('#advBody #tb-hbonds')) && !!(await page.$('#advBody #tb-advanced')), 'Erweitert enthält Schalter, Proton und H-Brücken');
  await page.click('#tabAdv');
  ok(!(await vis('#advBody')) && !(await vis('#sideBody')) && !(await vis('#dock')), 'Seitenleiste: Reiter erneut klappt zu');

  // Ausgangslage: erweiterte Werkzeuge sichtbar, aber gesperrt
  await openAdv();
  ok(await vis('#btnProton') && !(await usable('#btnProton')), 'Proton-Knopf anfangs gesperrt');
  ok(!(await usable('#tb-hbonds')), 'H-Brücken-Schalter anfangs gesperrt');

  // Erweiterte Funktionen einschalten im Bereich „Erweitert“
  await page.click('#tb-advanced');
  ok(await usable('#btnProton'), 'Proton-Knopf nach „Erweiterte Funktionen“ nutzbar');
  ok(await usable('#tb-hbonds'), 'H-Brücken-Schalter nutzbar');

  // H2O + Proton -> H3O+
  await page.evaluate(() => { const k = window.__kwm; k.world.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('h2o'); });
  await page.click('#btnProton');
  await page.evaluate(() => {
    const k = window.__kwm, w = k.world;
    const O = w.atoms.find(a => a.sym === 'O'), p = w.atoms.find(a => w.isProton(a));
    const lp = w.freePairs(O)[0];
    p.pos.copy(w.cloudCenter(O, lp));
    k.ui.selAtom = p.id; k.connectSelected(); k.finishAnim();
    k.ui.selAtom = O.id; k.refresh();
  });
  let t = await info();
  ok(/H₃O⁺/.test(t) && /Oxonium/.test(t) && /Ladung \+1/.test(t), 'Infokarte zeigt H₃O⁺, Oxonium-Ion, Ladung');
  ok(/trigonal-pyramidal/.test(t) && /formale Ladung/.test(t), 'Infokarte: formale Ladung am O und Geometrie');
  await openView(); await page.click('#tb-lewis');
  await page.waitForTimeout(300);
  await shot(page, 'h3o.png');

  // Proton abspalten
  await page.evaluate(() => { const k = window.__kwm, w = k.world; k.ui.selAtom = null; k.ui.selBond = w.bonds[0].id; k.refresh(); });
  ok(await vis('#bbProton'), '„H⁺ abspalten“ bei O–H sichtbar');
  ok(!(await vis('#bbRotL')), 'Drehknöpfe bei O–H versteckt');
  await page.click('#bbProton');
  await page.waitForTimeout(400);
  t = await info();
  ok(/H₂O/.test(t), 'nach Abspalten wieder H₂O: ' + t.slice(0, 60));

  // Ethan drehen
  await page.evaluate(() => { const k = window.__kwm, w = k.world; w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('c2h6'); const b = w.bonds.find(b => w.atom(b.a).sym === 'C' && w.atom(b.b).sym === 'C'); k.ui.selAtom = null; k.ui.selBond = b.id; k.refresh(); });
  ok(await vis('#bbRotL') && await vis('#bbRotR'), 'Drehknöpfe bei C–C sichtbar');
  t = await info();
  ok(/gestaffelt/.test(t), 'Ethan anfangs gestaffelt');
  for (let i = 0; i < 4; i++) await page.click('#bbRotL');
  t = await info();
  ok(/ekliptisch/.test(t) && /Diederwinkel 0°/.test(t), 'nach 4 × 15° ekliptisch: ' + (t.match(/Konformation[^.]*/) || [''])[0]);
  await shot(page, 'ethan.png');
  await page.click('#tb-undo');
  t = await info();
  ok(/Diederwinkel 15°/.test(t), 'Zurück macht einen Drehschritt rückgängig');

  // Newman-Projektion
  ok(await vis('#bbNewman'), 'Newman-Projektion sichtbar');
  const nm = await page.$eval('#bbNewman', e => ({ lines: e.querySelectorAll('line').length, texts: [...e.querySelectorAll('text')].map(x => x.textContent).join(''), cap: e.textContent }));
  ok(nm.lines === 6 && nm.texts === 'HHHHHH' && /C vorn, C hinten/.test(nm.cap), 'Newman Ethan: 6 Bindungen, ' + nm.cap);
  // Molekül drehen per Maus im Modus „Drehen“: Bindung bleibt gewählt
  await page.click('#tb-rotate');
  const scr = await page.evaluate(() => {
    const k = window.__kwm, w = k.world, cv = k.R.canvas.getBoundingClientRect();
    const a = w.atoms.find(x => x.sym === 'H'); const p = a.pos.clone().project(k.R.camera);
    return { x: cv.left + (p.x + 1) / 2 * cv.width, y: cv.top + (1 - p.y) / 2 * cv.height, id: a.id };
  });
  await page.mouse.move(scr.x, scr.y); await page.mouse.down(); await page.mouse.move(scr.x + 60, scr.y + 20, { steps: 6 }); await page.mouse.up();
  let sel = await page.evaluate(() => ({ b: window.__kwm.ui.selBond, a: window.__kwm.ui.selAtom }));
  ok(sel.b && !sel.a, 'nach Drehen des Moleküls ist die Bindung noch gewählt');
  ok(await vis('#bbNewman'), 'Newman-Projektion bleibt sichtbar');
  // Blick entlang
  await page.click('#bbView'); await page.waitForTimeout(500);
  const al = await page.evaluate(() => {
    const k = window.__kwm, w = k.world, b = w.bond(k.ui.selBond), A = w.atom(b.a).pos.clone().project(k.R.camera), B = w.atom(b.b).pos.clone().project(k.R.camera);
    return Math.hypot(A.x - B.x, A.y - B.y);
  });
  ok(al < 0.01, 'Blick entlang: beide C-Atome decken sich auf dem Bildschirm (' + al.toFixed(4) + ')');
  await shot(page, 'newman.png');
  // Antippen eines Atoms wählt das Atom
  const scr2 = await page.evaluate(() => {
    const k = window.__kwm, w = k.world, cv = k.R.canvas.getBoundingClientRect();
    const pts = w.atoms.filter(x => x.sym === 'H').map(a => { const p = a.pos.clone().project(k.R.camera); return { x: cv.left + (p.x + 1) / 2 * cv.width, y: cv.top + (1 - p.y) / 2 * cv.height }; });
    return pts.find(p => document.elementFromPoint(p.x, p.y) === k.R.canvas) || null;
  });
  ok(!!scr2, 'ein H-Atom ist frei antippbar');
  if (scr2) await page.mouse.click(scr2.x, scr2.y);
  sel = await page.evaluate(() => ({ b: window.__kwm.ui.selBond, a: window.__kwm.ui.selAtom }));
  ok(!sel.b && sel.a, 'Antippen eines Atoms wählt das Atom');
  await page.click('#tb-move');
  // Klick genau auf ein Elementsymbol wählt das Atom, auch wenn es in einer Bindungswolke steckt
  const scr3 = await page.evaluate(() => {
    const k = window.__kwm, w = k.world, cv = k.R.canvas.getBoundingClientRect();
    w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('hcl'); k.finishAnim(); k.ui.selAtom = null; k.ui.selBond = null; k.refresh();
    const H = w.atoms.find(a => a.sym === 'H'), p = H.pos.clone().project(k.R.camera);
    return { x: cv.left + (p.x + 1) / 2 * cv.width, y: cv.top + (1 - p.y) / 2 * cv.height, id: H.id };
  });
  await page.mouse.click(scr3.x, scr3.y);
  sel = await page.evaluate(() => ({ b: window.__kwm.ui.selBond, a: window.__kwm.ui.selAtom }));
  ok(sel.a === scr3.id && !sel.b, 'Klick auf das H-Symbol in HCl wählt das H-Atom');

  // Atomkugel: anfangs durchsichtig (Hülle der äußeren Stufe) → aus → durchsichtig → undurchsichtig (Bindungen gesperrt) → aus
  await openView();
  const ballLbl = () => page.$eval('#tb-ball button[aria-pressed="true"]', e => e.textContent);
  ok((await ballLbl()) === 'durchsichtig', 'Atomkugel anfangs durchsichtig');
  await page.click('#tb-ball-0');
  ok((await ballLbl()) === 'aus', 'Atomkugel: aus');
  await page.click('#tb-ball-1');
  ok((await ballLbl()) === 'durchsichtig' && await page.evaluate(() => window.__kwm.ui.ball === 1), 'Atomkugel: durchsichtig');
  await page.keyboard.press('u');
  ok((await ballLbl()) === 'undurchsichtig', 'Atomkugel: Taste U schaltet weiter auf undurchsichtig');
  await page.evaluate(() => { const k = window.__kwm, w = k.world; k.ui.selAtom = null; k.ui.selBond = w.bonds[0].id; k.refresh(); });
  ok(await page.$eval('#bbBreak', e => e.disabled), 'undurchsichtige Atomkugel: „Lösen“ gesperrt');
  const nb = await page.evaluate(() => { const k = window.__kwm; k.deleteSelection && k.deleteSelection(); return k.world.bonds.length; });
  ok(nb === 1, 'undurchsichtige Atomkugel: Bindung bleibt bestehen');
  await shot(page, 'atomkugel.png');
  await page.click('#tb-ball-0');
  ok((await ballLbl()) === 'aus' && !(await page.$eval('#bbBreak', e => e.disabled)), 'Atomkugel wieder aus, „Lösen“ frei');
  // Schatten: standardmäßig an, per Schalter aus und wieder an
  ok(await page.$eval('#tb-shadow', e => e.getAttribute('aria-pressed') === 'true'), 'Schatten anfangs an');
  await page.click('#tb-shadow');
  ok(await page.evaluate(() => window.__kwm.ui.shadow === false), 'Schatten aus');
  await page.click('#tb-shadow');

  // Ethen: Hinweis
  await page.evaluate(() => { const k = window.__kwm, w = k.world; w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('c2h4'); const b = w.bonds.find(b => b.order === 2); k.ui.selAtom = null; k.ui.selBond = b.id; k.refresh(); });
  await page.click('#bbRotL');
  ok(/Mehrfachbindung/.test(await page.$eval('#status', e => e.textContent)), 'Ethen: Hinweis zur Doppelbindung');

  // Wasserstoffbrücken
  await openAdv(); await page.click('#tb-hbonds');
  await page.evaluate(() => {
    const k = window.__kwm, w = k.world, T = window.THREE;
    w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('h2o'); k.addExample('h2o');
    const O1 = w.atoms[0], H1 = w.atoms[1], O2 = w.atoms[3], B = w.component(O2);
    const axis = H1.pos.clone().sub(O1.pos).normalize(), lp = w.freePairs(O2)[0];
    const q = new T.Quaternion().setFromUnitVectors(w.cloudDir(O2, lp), axis.clone().negate());
    const pv = O2.pos.clone(); B.forEach(a => { a.pos.sub(pv).applyQuaternion(q).add(pv); a.quat.premultiply(q); });
    const s = H1.pos.clone().add(axis.clone().multiplyScalar(1.2)).sub(w.cloudCenter(O2, lp));
    B.forEach(a => a.pos.add(s));
    k.ui.selAtom = O1.id; k.ui.selBond = null; k.refresh();
  });
  await page.waitForTimeout(300);
  t = await info();
  ok(/1 Wasserstoffbrücke/.test(t), 'Infokarte zählt eine Wasserstoffbrücke');
  await shot(page, 'hbrücke.png');

  // Erweitert aus: alles wieder weg
  await openAdv(); await page.click('#tb-advanced');
  ok(!(await usable('#btnProton')) && !(await usable('#tb-hbonds')), 'Erweitert aus: Knöpfe gesperrt');
  t = await info();
  ok(!/Wasserstoffbrücke/.test(t), 'Erweitert aus: keine H-Brücken-Anzeige');

  // Beispiele und Aufgaben der erweiterten Funktionen nur mit „Erweitert“
  const advEx = () => page.$eval('#exGrid .adv-only', e => !e.hidden);
  const taskSetNames = async () => { await page.click('#btnTasks'); const s = await page.$$eval('#tkList h3', hs => hs.map(h => h.textContent)); await page.keyboard.press('Escape'); return s; };
  ok(!(await advEx()), 'Beispiel-Kategorie „Geladene Teilchen“ versteckt');
  ok(!(await taskSetNames()).some(s => /Erweitert/.test(s)), 'Aufgabenset „Erweitert“ versteckt');
  // Eine erweiterte Aufgabe (etwa aus einem geteilten Link) schaltet „Erweitert“ selbst ein
  await page.evaluate(() => window.__kwm.startTask(window.KWM.Tasks.BUILTIN.find(t => t.adv)));
  await openAdv();
  ok(await page.evaluate(() => window.__kwm.ui.advanced) && await usable('#btnProton'), 'erweiterte Aufgabe schaltet „Erweitert“ ein');
  ok(await page.evaluate(() => window.__kwm.world.atoms.filter(a => window.__kwm.world.isProton(a)).length === 1), 'Startatome der Aufgabe enthalten ein Proton');
  ok(await advEx(), 'Beispiel-Kategorie mit „Erweitert“ sichtbar');
  ok((await taskSetNames()).some(s => /Erweitert/.test(s)), 'Aufgabenset „Erweitert“ mit „Erweitert“ sichtbar');
  await page.click('#tcClose');

  // „Drehen um Einfachbindungen“: Anleitung aufklappen, mit Ethan ausprobieren (schaltet „Erweitert“ selbst ein)
  await page.evaluate(() => { const k = window.__kwm; k.ui.advanced = false; k.refresh(); });
  await openAdv();
  ok(!(await vis('#advRotText')), 'Anleitung „Drehen um Einfachbindungen“ anfangs zu');
  await page.click('#advRotHelp');
  ok(await vis('#advRotText') && await page.$eval('#advRotHelp', e => e.getAttribute('aria-expanded') === 'true'), 'Anleitung klappt auf');
  await page.click('#advRotTry');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => { const k = window.__kwm, b = k.ui.selBond && k.world.bond(k.ui.selBond); return k.ui.advanced && !!b && k.world.atom(b.a).sym === 'C' && k.world.atom(b.b).sym === 'C'; }), '„Mit Ethan ausprobieren“: Erweitert an, C–C-Bindung gewählt');
  ok(await vis('#bbNewman'), '„Mit Ethan ausprobieren“: Newman-Projektion sichtbar');
  // Layout: Seitenbereich endet über der Bindungsleiste, Hinweiszeile überdeckt sie nicht
  const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const cut = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  await page.evaluate(() => { const s = document.getElementById('status'); s.textContent = 'Eine lange Hinweiszeile zum Testen der Lage über der Bindungsleiste.'; s.hidden = false; window.__kwm.refresh(); });
  ok((await box('#advBody')).b <= (await box('#bondbar')).t, 'Seitenbereich „Erweitert“ endet über der Bindungsleiste');
  ok(!cut(await box('#status'), await box('#bondbar')), 'Hinweiszeile überdeckt die Bindungsleiste nicht');
  await page.click('#advRotHelp');
  ok(!(await vis('#advRotText')), 'Anleitung klappt wieder zu');

  // Werkzeugleiste: Modi als Gruppe, altes Dock entfernt
  ok(await page.$$eval('#tbModes .tb', bs => bs.map(b => b.id).join()) === 'tb-move,tb-rotate,tb-height', 'Bewegen, Drehen, Höhe als Gruppe');
  ok(!(await page.$('#dockToggle')), 'alter Knopf „Ausblenden“ des Docks entfernt');

  // Neue Atome landen sichtbar auf der Fläche und nicht hinter der Infokarte
  await page.evaluate(() => { const k = window.__kwm; k.world.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('h2o'); k.ui.selAtom = null; k.refresh(); });
  await openPse();
  for (const s of ['C', 'N', 'O', 'F', 'Cl', 'S']) await page.click(`#pse button.el[data-sym="${s}"]`);
  const hidden = await page.evaluate(() => {
    const k = window.__kwm, st = document.getElementById('stage').getBoundingClientRect();
    const blockers = ['info', 'toolbar', 'sidePanels'].map(id => document.getElementById(id).getBoundingClientRect()).filter(r => r.width);
    return k.world.atoms.slice(3).filter(a => {
      const c = a.pos.clone().project(k.R.camera), x = st.left + (c.x + 1) / 2 * st.width, y = st.top + (1 - c.y) / 2 * st.height;
      return x < st.left || x > st.right || y < st.top || y > st.bottom || blockers.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom);
    }).map(a => a.sym);
  });
  ok(hidden.length === 0, 'neue Atome sichtbar, nicht hinter Karten oder Leisten' + (hidden.length ? ': ' + hidden.join() : ''));

  // Ziehen an einer Bindungswolke bewegt im Modus „Bewegen“ das Molekül, die Ansicht bleibt
  await page.click('#tb-move');
  const grab = await page.evaluate(() => {
    const k = window.__kwm, w = k.world;
    w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('c2h6'); k.ui.selAtom = null; k.ui.selBond = null; k.refresh();
    const b = w.bonds.find(x => w.atom(x.a).sym === 'C' && w.atom(x.b).sym === 'C');
    const m = w.atom(b.a).pos.clone().add(w.atom(b.b).pos).multiplyScalar(0.5).project(k.R.camera);
    const st = document.getElementById('stage').getBoundingClientRect();
    return { x: st.left + (m.x + 1) / 2 * st.width, y: st.top + (1 - m.y) / 2 * st.height, theta: k.orbit.theta, c: w.atoms[0].pos.toArray() };
  });
  await page.mouse.move(grab.x, grab.y); await page.mouse.down();
  await page.mouse.move(grab.x + 40, grab.y + 10, { steps: 4 }); await page.mouse.move(grab.x + 80, grab.y + 20, { steps: 4 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ theta: window.__kwm.orbit.theta, c: window.__kwm.world.atoms[0].pos.toArray() }));
  const movedBy = Math.hypot(after.c[0] - grab.c[0], after.c[2] - grab.c[2]);
  ok(after.theta === grab.theta && movedBy > 0.3, 'Ziehen an der C–C-Bindung verschiebt Ethan, Ansicht bleibt (' + movedBy.toFixed(2) + ')');

  // Hilfe: zwei Reiter, alle Bilder vorhanden, Inhaltsverzeichnis scrollt im Fenster, Druckknopf
  await page.click('#btnHelp');
  const helpOpen = () => page.$eval('#ovHelp', e => !e.hidden);   // Fenster ist fixed: offsetParent ist immer null
  ok(await helpOpen() && await vis('#helpL') && !(await vis('#helpT')), 'Hilfe öffnet mit „Für Lernende“');
  const shotInfo = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#ovHelp img[data-shot]')];
    return { n: imgs.length, missing: imgs.filter(i => !/^data:image\/webp;base64,/.test(i.src)).map(i => i.dataset.shot), noAlt: imgs.filter(i => !i.alt).length };
  });
  ok(shotInfo.n >= 20 && !shotInfo.missing.length && !shotInfo.noAlt, 'Hilfe: ' + shotInfo.n + ' Bilder mit Alternativtext' + (shotInfo.missing.length ? ', fehlend: ' + shotInfo.missing.join() : ''));
  await page.click('#helpL a[href="#hl-aufgaben"]');
  ok(await page.evaluate(() => { const r = document.getElementById('hl-aufgaben').getBoundingClientRect(), s = document.querySelector('#ovHelp .sheet').getBoundingClientRect(); return r.top >= s.top - 2 && r.top < s.top + 200 && !location.hash; }), 'Inhaltsverzeichnis springt im Fenster, Adresse bleibt');
  await page.click('#helpTabT');
  ok(await vis('#helpT') && !(await vis('#helpL')) && await page.$eval('#helpTabT', e => e.getAttribute('aria-selected') === 'true'), 'Reiter „Für Lehrende“');
  ok(await page.$$eval('#helpT section h3', hs => hs.map(h => h.textContent).join('|')).then(t => /Aufgaben verteilen/.test(t) && /Modell und seine Grenzen/.test(t)), 'Lehrende: Verteilen und Modellgrenzen');
  await page.keyboard.press('ArrowLeft');
  ok(await vis('#helpL'), 'Pfeiltaste wechselt den Reiter');
  ok(await vis('#helpPrint'), 'Knopf „Drucken / PDF“');
  await page.keyboard.press('Escape');
  ok(!(await helpOpen()), 'Esc schließt die Hilfe');
  await page.keyboard.press('?');
  ok(await helpOpen(), 'Taste ? öffnet die Hilfe');
  await page.keyboard.press('Escape');

  // Speichern über Neuladen (gleiche Seite, gleicher localStorage)
  await page.evaluate(() => { const k = window.__kwm; k.world.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('h2o'); k.addProton(); });
  await page.waitForTimeout(700);
  await page.goto(file); await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({ adv: window.__kwm.ui.advanced, protons: window.__kwm.world.atoms.filter(a => window.__kwm.world.isProton(a)).length }));
  ok(st.adv && st.protons === 1, 'nach Neuladen: Erweitert an, Proton erhalten');

  // Handybreite: Bindungsleiste mit Newman-Projektion passt auf den Bildschirm
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.addInitScript(() => { window.__KWM_TEST__ = true; });
  await phone.goto(file); await phone.waitForTimeout(800);
  if (await phone.$eval('#coach', e => !e.hidden)) await phone.click('#coachOk');
  const bb = await phone.evaluate(() => {
    const k = window.__kwm, w = k.world;
    k.ui.advanced = true; w.load({ atoms: [], bonds: [], nid: 1, bid: 1 }); k.addExample('c2h6');
    const b = w.bonds.find(b => w.atom(b.a).sym === 'C' && w.atom(b.b).sym === 'C');
    k.ui.selAtom = null; k.ui.selBond = b.id; k.refresh();
    const r = document.getElementById('bondbar').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, stageTop: s.top, stageBottom: s.bottom, newman: !document.getElementById('bbNewman').hidden };
  });
  console.log('  Handy: Bindungsleiste', JSON.stringify(bb));
  ok(bb.newman && bb.left >= 0 && bb.right <= 390, 'Handy: Bindungsleiste mit Newman-Projektion innerhalb der Bildschirmbreite');
  ok(bb.height <= (bb.stageBottom - bb.stageTop) * 0.5, 'Handy: Bindungsleiste belegt höchstens die halbe Arbeitsfläche');
  // Handy: Seitenbereich als Blatt von unten, über der Bindungsleiste, Werkzeugleiste und Reiter bleiben frei
  if (await phone.$eval('#sideBody', e => e.hidden)) await phone.click('#sideToggle');
  const pb = await phone.evaluate(() => {
    const r = id => { const q = document.getElementById(id).getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
    const t = document.querySelector('.side-tabs').getBoundingClientRect();
    return { sheet: r('sideBody'), bar: r('bondbar'), tool: r('toolbar'), tabsLeft: t.left };
  });
  ok(pb.sheet.t >= pb.tool.b && pb.sheet.b <= pb.bar.t, 'Handy: Blatt zwischen Werkzeugleiste und Bindungsleiste');
  ok(pb.sheet.r <= pb.tabsLeft && pb.tabsLeft > 300, 'Handy: Reiter rechts neben dem Blatt');
  await shot(phone, 'handy.png');

  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? fails + ' Fehler' : 'Alle UI-Tests bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
