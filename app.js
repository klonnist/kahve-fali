(() => {
  const $ = (id) => document.getElementById(id);
  const FAL = window.FAL;
  const A = 160;   // analiz çözünürlüğü
  const P = 720;   // önizleme çözünürlüğü (aynı kare kırpma → koordinatlar A→P ölçeklenir)
  let lastText = '';

  const SLOTS = [
    { id: 'cup1', icon: '☕', name: '1. Fincan', hint: 'Fincanın içi, bir yanı' },
    { id: 'cup2', icon: '☕', name: '2. Fincan', hint: 'Fincanı çevir, öbür yanı' },
    { id: 'saucer', icon: '🍽️', name: 'Tabak', hint: 'Fincanı kapattığın tabak' }
  ];
  const photos = {}; // id → { bmp, preview }

  const screens = ['home', 'loading', 'result'];
  function show(name) {
    screens.forEach((s) => $('screen-' + s).classList.toggle('active', s === name));
    window.scrollTo({ top: 0 });
  }

  function showError(msg) {
    const el = $('error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2400);
  }

  // ---------- Görsel yükleme (EXIF yönü dahil) ----------
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* aşağıdaki yola düş */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Görüntünün ortasından kare bir parça alıp size×size canvas'a çizer.
  function squareCanvas(src, size) {
    const w = src.width, h = src.height;
    const side = Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return c;
  }

  // ---------- Rastgelelik: aynı fotolar → aynı fal ----------
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Telve analizi ----------
  function analyze(canvas) {
    const N = canvas.width;
    const data = canvas.getContext('2d').getImageData(0, 0, N, N).data;
    const gray = new Float32Array(N * N);
    const inside = new Uint8Array(N * N);
    const cx = (N - 1) / 2, R = N * 0.45; // kenar/köşe gölgelerini dışarıda bırak
    let hash = 2166136261, cnt = 0;
    const hist = new Array(256).fill(0);

    for (let i = 0; i < N * N; i++) {
      const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gray[i] = v;
      hash = Math.imul(hash ^ (v >> 2), 16777619);
      const x = i % N, y = (i / N) | 0;
      if ((x - cx) ** 2 + (y - cx) ** 2 <= R * R) {
        inside[i] = 1; cnt++;
        hist[v | 0]++;
      }
    }

    // Otsu eşiği: koyu telve ile açık zemin
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 100;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = cnt - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; thr = t; }
    }
    const mean = sum / cnt;
    let varSum = 0;
    for (let i = 0; i < 256; i++) varSum += hist[i] * (i - mean) ** 2;
    const contrast = Math.sqrt(varSum / cnt);
    // Neredeyse düz bir görüntüde Otsu gürültüyü telve sanmasın
    if (contrast < 10) thr = mean - 30;

    const dark = new Uint8Array(N * N);
    let dCount = 0, rim = 0, rimAll = 0, core = 0, coreAll = 0, left = 0, right = 0;
    for (let i = 0; i < N * N; i++) {
      if (!inside[i]) continue;
      const x = i % N, y = (i / N) | 0;
      const rr = Math.hypot(x - cx, y - cx) / R;
      const isDark = gray[i] < thr ? 1 : 0;
      dark[i] = isDark;
      dCount += isDark;
      if (rr > 0.62) { rimAll++; rim += isDark; }
      if (rr < 0.38) { coreAll++; core += isDark; }
      if (x < cx) left += isDark; else right += isDark;
    }

    // Bağlantılı lekeler + şekil bilgisi
    const seen = new Uint8Array(N * N);
    const stack = [];
    const blobsList = [];
    const cell = new Float32Array(64); // 8×8 ızgarada küçük tanecik yoğunluğu
    let specks = 0, blobs = 0, largest = 0;
    for (let i = 0; i < N * N; i++) {
      if (!dark[i] || seen[i]) continue;
      let size = 0, sx = 0, sy = 0, minX = N, maxX = 0, minY = N, maxY = 0;
      stack.push(i); seen[i] = 1;
      while (stack.length) {
        const p = stack.pop(); size++;
        const x = p % N, y = (p / N) | 0;
        sx += x; sy += y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0 && dark[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < N - 1 && dark[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && dark[p - N] && !seen[p - N]) { seen[p - N] = 1; stack.push(p - N); }
        if (y < N - 1 && dark[p + N] && !seen[p + N]) { seen[p + N] = 1; stack.push(p + N); }
      }
      if (size <= 8) {
        specks++;
        cell[((sy / size) * 8 / N | 0) * 8 + ((sx / size) * 8 / N | 0)] += 1;
      } else if (size >= 40) blobs++;
      if (size > largest) largest = size;
      if (size >= 14 && size <= cnt * 0.12) {
        const w = maxX - minX + 1, h = maxY - minY + 1;
        blobsList.push({ x: sx / size, y: sy / size, w, h, size, aspect: Math.max(w, h) / Math.min(w, h), fill: size / (w * h) });
      }
    }

    // İşaretlenecek adaylar: büyükten küçüğe, birbirine çok yakın olmayan en fazla 3 leke
    blobsList.sort((a, b) => b.size - a.size);
    const marks = [];
    for (const b of blobsList) {
      if (marks.length >= 3) break;
      if (marks.some((m) => Math.hypot(m.x - b.x, m.y - b.y) < N * 0.16)) continue;
      b.shape = b.aspect > 2.2 || b.fill < 0.3 ? 'long'
        : b.size > cnt * 0.02 ? 'big'
        : b.fill > 0.55 && b.aspect < 1.5 ? 'round' : 'mixed';
      b.r = Math.max(b.w, b.h) / 2 + 4;
      marks.push(b);
    }
    // Tanecik kümesi (balık/yıldız): en yoğun hücre
    let bestCell = -1;
    for (let k = 0; k < 64; k++) if (cell[k] >= 4 && (bestCell < 0 || cell[k] > cell[bestCell])) bestCell = k;
    if (bestCell >= 0 && marks.length < 3) {
      const x = ((bestCell % 8) + 0.5) * N / 8, y = (((bestCell / 8) | 0) + 0.5) * N / 8;
      if (!marks.some((m) => Math.hypot(m.x - x, m.y - y) < N * 0.16)) {
        marks.push({ x, y, r: N / 12, shape: 'cluster' });
      }
    }

    return {
      seed: hash >>> 0,
      density: dCount / cnt,
      rimRatio: rim / Math.max(1, rimAll),
      coreRatio: core / Math.max(1, coreAll),
      leftShare: left / Math.max(1, left + right),
      specks: Math.min(1, specks / 120),
      blobs: Math.min(1, blobs / 12),
      largest: largest / cnt,
      contrast,
      marks,
      N
    };
  }

  // ---------- Falı oluştur ----------
  const SHAPE_W = {
    long: { yol: 5, yilan: 4, at: 1.5, kus: 1 },
    round: { yuzuk: 4, ay: 3, kalp: 3, goz: 3, yildiz: 1 },
    big: { dag: 5, agac: 4, ev: 3, kopek: 1.5 },
    mixed: { kus: 3, kus2: 2.5, at: 2.5, kelebek: 2.5, cicek: 2, anahtar: 2, kapi: 1.5, mektup: 1.5, kopek: 1 },
    cluster: { balik: 5, yildiz: 3 }
  };

  function positionText(m, N) {
    const c = (N - 1) / 2, dx = (m.x - c) / (N / 2), dy = (m.y - c) / (N / 2);
    if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return 'tam ortada';
    const v = dy < -0.25 ? 'üst' : dy > 0.25 ? 'alt' : '';
    const h = dx < -0.25 ? 'sol' : dx > 0.25 ? 'sağ' : '';
    return (h && v ? h + ' ' + v : h || v) + ' tarafta';
  }

  function compose(c1, c2, s) {
    const rnd = mulberry32((c1.seed ^ Math.imul(c2.seed, 2654435761) ^ Math.imul(s.seed, 40503)) >>> 0);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const clamp = (v) => Math.max(0.05, Math.min(0.97, v));
    const jitter = (v, amt = 0.25) => clamp(v + (rnd() - 0.5) * amt);
    const dens = (f) => clamp((f.density - 0.12) / 0.45);
    const level = (v) => (v < 0.36 ? 'low' : v > 0.64 ? 'high' : 'mid');

    const scores = {
      genel: jitter(dens(c1)),
      ask: jitter(0.35 + c1.leftShare * 0.5 + c1.blobs * 0.2, 0.45),
      para: jitter(c1.specks * 0.8 + dens(c1) * 0.3),
      haber: jitter(c2.rimRatio * 1.2 + 0.1),
      ruh: jitter(dens(c2) * 0.7 + c2.largest * 2),
      gelecek: jitter(0.3 + c2.blobs * 0.4 + c2.contrast / 200, 0.4)
    };

    // Semboller: her fotoğraftaki işaretli şekillere bağlanır (fincan başına 2, tabakta 1)
    const used = new Set();
    const chosen = [];
    const fallbackW = (f) => ({
      balik: 1 + f.specks * 4, yildiz: 1 + f.specks * 2, yol: 1 + (1 - dens(f)) * 3, kus: 1 + (1 - dens(f)) * 2,
      dag: 1 + dens(f) * 3, kalp: 1 + f.leftShare * 2, goz: 1 + f.blobs * 2
    });
    [[c1, 0, 2], [c2, 1, 2], [s, 2, 1]].forEach(([f, photo, want]) => {
      const marks = f.marks.slice(0, want);
      for (let k = 0; k < want; k++) {
        const m = marks[k];
        const extra = m ? SHAPE_W[m.shape] : fallbackW(f);
        const pool = FAL.symbols.filter((x) => !used.has(x.id));
        const w = pool.map((x) => 0.4 + (extra[x.id] || 0));
        let r = rnd() * w.reduce((a, b) => a + b, 0), idx = 0;
        for (; idx < pool.length - 1; idx++) { r -= w[idx]; if (r <= 0) break; }
        const sym = pool[idx];
        used.add(sym.id);
        chosen.push({ sym, photo, mark: m || null, where: m ? positionText(m, f.N) : '' });
      }
    });
    chosen.forEach((c, i) => (c.n = i + 1));

    const avg = { density: (c1.density + c2.density) / 2 };
    const tone = level(dens(avg)) === 'low' ? 'light' : level(dens(avg)) === 'high' ? 'dark' : 'mid';
    const rimR = (c1.rimRatio + c2.rimRatio) / 2, coreR = (c1.coreRatio + c2.coreRatio) / 2;
    const timing = rimR > coreR * 1.25 ? 'near' : coreR > rimR * 1.25 ? 'far' : 'even';
    const ls = (c1.leftShare + c2.leftShare) / 2;
    const side = ls > 0.55 ? 'left' : ls < 0.45 ? 'right' : null;

    const sections = Object.keys(FAL.sections).map((key) => {
      const sec = FAL.sections[key];
      let text = pick(sec[level(scores[key])]);
      if (key === 'genel') text += ' ' + FAL.timing[timing] + (side ? ' ' + FAL.sides[side] : '');
      return { key, icon: sec.icon, title: sec.title, text, score: scores[key] };
    });

    const sDens = jitter(dens(s), 0.2);
    sections.push({ key: 'tabak', icon: FAL.saucer.icon, title: FAL.saucer.title, text: pick(FAL.saucer[level(sDens)]), score: sDens });

    const wishYes = jitter(1 - dens(s) * 0.7, 0.5) > 0.42;
    return {
      title: pick(FAL.titles[tone]),
      symbols: chosen,
      sections,
      wish: {
        big: pick(wishYes ? FAL.wish.yes : FAL.wish.soon),
        text: pick(wishYes ? FAL.wish.yesText : FAL.wish.soonText)
      }
    };
  }

  const meterNames = {
    genel: ['Hafif', 'Yoğun'], ask: ['Sakin', 'Hareketli'], para: ['İdare eder', 'Bereketli'],
    haber: ['Uzak', 'Kapıda'], ruh: ['Ferah', 'Yorgun'], gelecek: ['Durgun', 'Değişken'], tabak: ['Huzurlu', 'Kalabalık']
  };

  // ---------- Galeri ve işaretler ----------
  function focusSymbol(n) {
    const mark = document.querySelector('.mark[data-n="' + n + '"]');
    if (!mark) return;
    const shot = mark.closest('.shot');
    const g = $('gallery');
    g.scrollTo({ left: shot.offsetLeft - g.offsetLeft, behavior: 'smooth' });
    $('gallery-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.mark.pulse').forEach((m) => m.classList.remove('pulse'));
    void mark.offsetWidth;
    mark.classList.add('pulse');
  }

  function renderGallery(fal, previews, analyses) {
    const g = $('gallery'), dots = $('gallery-dots');
    g.innerHTML = ''; dots.innerHTML = '';
    previews.forEach((src, photo) => {
      const fig = document.createElement('figure');
      fig.className = 'shot';
      const frame = document.createElement('div');
      frame.className = 'shot-frame';
      const img = document.createElement('img');
      img.src = src; img.alt = FAL.cupLabels[photo];
      frame.appendChild(img);
      const N = analyses[photo].N;
      fal.symbols.filter((c) => c.photo === photo && c.mark).forEach((c, k) => {
        const m = c.mark;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mark' + (m.y / N < 0.22 ? ' low' : '');
        b.dataset.n = c.n;
        const size = Math.max(m.r * 2, N * 0.14) / N * 100;
        b.style.left = (m.x / N * 100) + '%';
        b.style.top = (m.y / N * 100) + '%';
        b.style.width = b.style.height = size + '%';
        b.style.animationDelay = (0.4 + k * 0.35) + 's';
        b.setAttribute('aria-label', c.sym.name);
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = c.n + ' ' + c.sym.icon + ' ' + c.sym.name;
        b.appendChild(tag);
        b.addEventListener('click', () => {
          const li = document.querySelector('.symlist li[data-n="' + c.n + '"]');
          if (li) li.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        frame.appendChild(b);
      });
      const cap = document.createElement('figcaption');
      cap.textContent = FAL.cupLabels[photo].replace(/^./, (ch) => ch.toLocaleUpperCase('tr'));
      fig.append(frame, cap);
      g.appendChild(fig);

      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', cap.textContent);
      d.addEventListener('click', () => g.scrollTo({ left: fig.offsetLeft - g.offsetLeft, behavior: 'smooth' }));
      dots.appendChild(d);
    });
    const sync = () => {
      const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    };
    g.onscroll = sync;
    sync();
  }

  function render(fal, previews, analyses) {
    const th = $('thumbs');
    th.innerHTML = '';
    previews.forEach((src) => { const im = document.createElement('img'); im.src = src; im.alt = ''; th.appendChild(im); });
    $('title').textContent = fal.title;

    $('symbols').innerHTML = '';
    fal.symbols.forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = '<span class="num"></span><span></span>';
      chip.children[0].textContent = c.n;
      chip.children[1].textContent = c.sym.icon + ' ' + c.sym.name;
      chip.addEventListener('click', () => focusSymbol(c.n));
      $('symbols').appendChild(chip);
    });

    renderGallery(fal, previews, analyses);

    const cards = $('cards');
    cards.innerHTML = '';

    // Gördüklerim kartı: numaralı liste
    const symCard = document.createElement('article');
    symCard.className = 'card';
    symCard.innerHTML = '<h3><span class="ico">👁️</span><span>Fincanda Gördüklerim</span></h3><ul class="symlist"></ul>';
    fal.symbols.forEach((c) => {
      const li = document.createElement('li');
      li.dataset.n = c.n;
      li.innerHTML = '<span class="num"></span><div><strong></strong><span class="where"></span><span class="t"></span></div>';
      li.querySelector('.num').textContent = c.n;
      li.querySelector('strong').textContent = c.sym.icon + ' ' + c.sym.name;
      li.querySelector('.where').textContent = FAL.cupLabels[c.photo] + (c.where ? ', ' + c.where : '');
      li.querySelector('.t').textContent = c.sym.text;
      li.addEventListener('click', () => focusSymbol(c.n));
      symCard.querySelector('ul').appendChild(li);
    });
    cards.appendChild(symCard);

    fal.sections.forEach((s, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.style.animationDelay = ((i + 1) * 0.12) + 's';
      const h = document.createElement('h3');
      h.innerHTML = '<span class="ico"></span><span></span>';
      h.children[0].textContent = s.icon;
      h.children[1].textContent = s.title;
      const p = document.createElement('p');
      p.textContent = s.text;
      const m = document.createElement('div');
      m.className = 'meter';
      m.innerHTML = '<i></i>';
      const lbl = document.createElement('div');
      lbl.className = 'meter-label';
      lbl.innerHTML = '<span></span><span></span>';
      lbl.children[0].textContent = meterNames[s.key][0];
      lbl.children[1].textContent = meterNames[s.key][1];
      card.append(h, p, m, lbl);
      requestAnimationFrame(() => requestAnimationFrame(() => (m.firstChild.style.width = Math.round(s.score * 100) + '%')));
      cards.appendChild(card);
    });

    const wish = $('wish');
    wish.innerHTML = '<span class="eyebrow">Niyetin (tabaktan)</span><span class="big"></span><p></p>';
    wish.children[1].textContent = '🌟 ' + fal.wish.big;
    wish.children[2].textContent = fal.wish.text;

    lastText = '☕ Kahve Falım: ' + fal.title + '\n\n' +
      'Gördüklerim: ' + fal.symbols.map((c) => c.sym.icon + ' ' + c.sym.name).join(', ') + '\n\n' +
      fal.sections.map((s) => s.icon + ' ' + s.title + ': ' + s.text).join('\n\n') +
      '\n\n🌟 Niyet: ' + fal.wish.big + ' ' + fal.wish.text;
  }

  // ---------- Yükleme kutuları ----------
  function buildSlots() {
    const wrap = $('slots');
    SLOTS.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.slot = s.id;
      el.innerHTML =
        '<div class="slot-pic"><span class="slot-ico"></span><span class="ok">✓</span></div>' +
        '<div class="slot-body"><b></b><small></small><div class="slot-btns">' +
        '<label class="mini cam"><input type="file" accept="image/*" capture="environment" hidden><span>📷 Çek</span></label>' +
        '<label class="mini"><input type="file" accept="image/*" hidden><span>🖼️ Galeri</span></label>' +
        '</div></div>';
      el.querySelector('.slot-ico').textContent = s.icon;
      el.querySelector('b').textContent = s.name;
      el.querySelector('small').textContent = s.hint;
      el.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', (e) => {
        setSlot(s.id, e.target.files[0]);
        e.target.value = '';
      }));
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag'));
      el.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation();
        el.classList.remove('drag'); $('dropzone').classList.remove('drag');
        setSlot(s.id, e.dataTransfer.files[0]);
      });
      wrap.appendChild(el);
    });
  }

  function refreshSlots() {
    let done = 0;
    SLOTS.forEach((s) => {
      const el = document.querySelector('.slot[data-slot="' + s.id + '"]');
      const ph = photos[s.id];
      el.classList.toggle('done', !!ph);
      const pic = el.querySelector('.slot-pic');
      let img = pic.querySelector('img');
      if (ph) {
        done++;
        if (!img) { img = document.createElement('img'); img.alt = s.name; pic.prepend(img); }
        img.src = ph.thumb;
      } else if (img) img.remove();
      el.querySelector('.cam span').textContent = ph ? '📷 Yeniden' : '📷 Çek';
      el.querySelector('.mini:not(.cam) span').textContent = ph ? '🖼️ Değiştir' : '🖼️ Galeri';
    });
    $('counter').textContent = done === 3 ? 'Hazır! Telveler seni bekliyor ✨' : done + '/3 fotoğraf yüklendi';
    $('btn-start').disabled = done < 3;
  }

  async function setSlot(id, file) {
    showError('');
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) { showError('Lütfen bir fotoğraf seç.'); return; }
    let bmp;
    try {
      bmp = await loadBitmap(file);
    } catch (e) {
      showError('Bu fotoğraf açılamadı. iPhone kullanıyorsan Ayarlar › Kamera › Biçimler › "En Uyumlu" seçip tekrar dene ya da ekran görüntüsü yükle.');
      return;
    }
    const prevCanvas = squareCanvas(bmp, P);
    photos[id] = {
      preview: prevCanvas.toDataURL('image/jpeg', 0.85),
      thumb: squareCanvas(prevCanvas, 160).toDataURL('image/jpeg', 0.8),
      analysis: analyze(squareCanvas(bmp, A))
    };
    if (bmp.close) bmp.close();
    refreshSlots();
  }

  function start() {
    if (SLOTS.some((s) => !photos[s.id])) return;
    const list = SLOTS.map((s) => photos[s.id]);
    const orbs = $('orbs');
    orbs.innerHTML = '';
    list.forEach((p) => {
      const o = document.createElement('div');
      o.className = 'orb';
      o.innerHTML = '<img alt=""><div class="orb-ring"></div>';
      o.querySelector('img').src = p.thumb;
      orbs.appendChild(o);
    });
    show('loading');

    const msgs = FAL.loading;
    let i = 0;
    const lt = $('loading-text');
    lt.textContent = msgs[0];
    const timer = setInterval(() => {
      i = (i + 1) % msgs.length;
      lt.style.opacity = 0;
      setTimeout(() => { lt.textContent = msgs[i]; lt.style.opacity = 1; }, 300);
    }, 1000);

    const analyses = list.map((p) => p.analysis);
    const fal = compose(analyses[0], analyses[1], analyses[2]);
    setTimeout(() => {
      clearInterval(timer);
      render(fal, list.map((p) => p.preview), analyses);
      show('result');
    }, 5200);
  }

  buildSlots();
  refreshSlots();

  const dz = $('dropzone');
  document.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('drag'); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('drag');
    if (!$('screen-home').classList.contains('active')) return;
    // Sayfaya bırakılan dosyalar sırayla boş kutulara
    const files = [...e.dataTransfer.files];
    const empty = SLOTS.filter((s) => !photos[s.id]).map((s) => s.id);
    files.forEach((f, k) => setSlot(empty[k] || SLOTS[k % 3].id, f));
  });

  $('btn-start').addEventListener('click', start);
  $('btn-again').addEventListener('click', () => {
    SLOTS.forEach((s) => delete photos[s.id]);
    refreshSlots();
    show('home');
  });

  $('btn-share').addEventListener('click', async () => {
    const url = location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title: 'Kahve Falım', text: lastText, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(lastText + '\n\n' + url);
      toast('Falın kopyalandı, istediğin yere yapıştır 💌');
    } catch (e) {
      toast('Paylaşılamadı, ekran görüntüsü alabilirsin 📸');
    }
  });

  window.__kahveFali = { analyze, compose, setSlot, start };
})();
