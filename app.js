(() => {
  const $ = (id) => document.getElementById(id);
  const FAL = window.FAL;
  let lastText = '';

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
  function squareCanvas(src, size, crop) {
    const w = src.width, h = src.height;
    const side = Math.min(w, h) * crop;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return c;
  }

  // ---------- Rastgelelik: aynı foto → aynı fal ----------
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
    const cx = (N - 1) / 2, R = N / 2;
    let hash = 2166136261, warm = 0, cnt = 0;
    const hist = new Array(256).fill(0);

    for (let i = 0; i < N * N; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const v = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = v;
      hash = Math.imul(hash ^ (v >> 2), 16777619);
      const x = i % N, y = (i / N) | 0;
      if ((x - cx) ** 2 + (y - cx) ** 2 <= R * R) {
        inside[i] = 1; cnt++;
        hist[v | 0]++;
        warm += r - b;
      }
    }

    // Otsu eşiği: koyu telve ile açık fincan zeminini ayırır
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

    // Bağlantılı lekeler: küçük taneler (kısmet) ve büyük kütleler
    const seen = new Uint8Array(N * N);
    const stack = [];
    let specks = 0, blobs = 0, largest = 0;
    for (let i = 0; i < N * N; i++) {
      if (!dark[i] || seen[i]) continue;
      let size = 0;
      stack.push(i); seen[i] = 1;
      while (stack.length) {
        const p = stack.pop(); size++;
        const x = p % N, y = (p / N) | 0;
        if (x > 0 && dark[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < N - 1 && dark[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && dark[p - N] && !seen[p - N]) { seen[p - N] = 1; stack.push(p - N); }
        if (y < N - 1 && dark[p + N] && !seen[p + N]) { seen[p + N] = 1; stack.push(p + N); }
      }
      if (size <= 8) specks++;
      else if (size >= 40) blobs++;
      if (size > largest) largest = size;
    }

    const density = dCount / cnt;
    return {
      seed: hash >>> 0,
      density,
      rimRatio: rim / Math.max(1, rimAll),
      coreRatio: core / Math.max(1, coreAll),
      leftShare: left / Math.max(1, left + right),
      specks: Math.min(1, specks / 120),
      blobs: Math.min(1, blobs / 12),
      largest: largest / cnt,
      warmth: warm / cnt,
      contrast
    };
  }

  // ---------- Falı oluştur ----------
  function compose(f) {
    const rnd = mulberry32(f.seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const clamp = (v) => Math.max(0.05, Math.min(0.97, v));
    const jitter = (v, amt = 0.25) => clamp(v + (rnd() - 0.5) * amt);

    // Yoğunluk normalde ~%15–%55 aralığında; 0–1'e yay
    const dens = clamp((f.density - 0.12) / 0.45);

    const scores = {
      genel: jitter(dens),
      ask: jitter(0.35 + f.leftShare * 0.5 + f.blobs * 0.2, 0.45),
      para: jitter(f.specks * 0.8 + dens * 0.3),
      haber: jitter(f.rimRatio * 1.2 + 0.1),
      ruh: jitter(dens * 0.7 + f.largest * 2),
      gelecek: jitter(0.3 + f.blobs * 0.4 + f.contrast / 200, 0.4)
    };
    const level = (s) => (s < 0.36 ? 'low' : s > 0.64 ? 'high' : 'mid');

    // Semboller: özelliklere göre ağırlıklı seçim
    const weights = {};
    FAL.symbols.forEach((s) => (weights[s.id] = 1));
    weights.balik += f.specks * 4;
    weights.yildiz += f.specks * 2;
    weights.yol += (1 - dens) * 3;
    weights.kus += (1 - dens) * 2 + f.rimRatio * 2;
    weights.mektup += f.rimRatio * 2;
    weights.dag += dens * 3 + f.largest * 6;
    weights.agac += dens * 2;
    weights.kalp += f.leftShare * 2;
    weights.goz += f.blobs * 2;
    weights.yilan += f.blobs * 1.5;
    weights.ay += f.coreRatio < f.rimRatio ? 1.5 : 0;
    const pool = FAL.symbols.slice();
    const chosen = [];
    const count = 3 + (rnd() < 0.5 ? 1 : 0);
    while (chosen.length < count && pool.length) {
      const total = pool.reduce((a, s) => a + weights[s.id], 0);
      let r = rnd() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= weights[pool[idx].id]; if (r <= 0) break; }
      chosen.push(pool.splice(idx, 1)[0]);
    }

    const tone = dens < 0.36 ? 'light' : dens > 0.64 ? 'dark' : 'mid';
    const timing = f.rimRatio > f.coreRatio * 1.25 ? 'near' : f.coreRatio > f.rimRatio * 1.25 ? 'far' : 'even';
    const side = f.leftShare > 0.55 ? 'left' : f.leftShare < 0.45 ? 'right' : null;

    const sections = Object.keys(FAL.sections).map((key) => {
      const sec = FAL.sections[key];
      let text = pick(sec[level(scores[key])]);
      if (key === 'genel') text += ' ' + FAL.timing[timing] + (side ? ' ' + FAL.sides[side] : '');
      return { key, icon: sec.icon, title: sec.title, text, score: scores[key] };
    });

    const wishYes = jitter(1 - f.coreRatio * 0.6, 0.6) > 0.45;
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
    haber: ['Uzak', 'Kapıda'], ruh: ['Ferah', 'Yorgun'], gelecek: ['Durgun', 'Değişken']
  };

  function render(fal, imgUrl) {
    $('thumb').src = imgUrl;
    $('title').textContent = fal.title;

    $('symbols').innerHTML = '';
    fal.symbols.forEach((s) => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = s.icon + ' ' + s.name;
      $('symbols').appendChild(c);
    });

    const cards = $('cards');
    cards.innerHTML = '';
    const symCard = {
      icon: '👁️', title: 'Fincanda Gördüklerim',
      text: fal.symbols.map((s) => s.text).join(' ')
    };
    [symCard, ...fal.sections].forEach((s, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.style.animationDelay = (i * 0.12) + 's';
      const h = document.createElement('h3');
      h.innerHTML = '<span class="ico"></span><span></span>';
      h.children[0].textContent = s.icon;
      h.children[1].textContent = s.title;
      const p = document.createElement('p');
      p.textContent = s.text;
      card.append(h, p);
      if (s.key) {
        const m = document.createElement('div');
        m.className = 'meter';
        m.innerHTML = '<i></i>';
        const lbl = document.createElement('div');
        lbl.className = 'meter-label';
        lbl.innerHTML = '<span></span><span></span>';
        lbl.children[0].textContent = meterNames[s.key][0];
        lbl.children[1].textContent = meterNames[s.key][1];
        card.append(m, lbl);
        requestAnimationFrame(() => requestAnimationFrame(() => (m.firstChild.style.width = Math.round(s.score * 100) + '%')));
      }
      cards.appendChild(card);
    });

    const wish = $('wish');
    wish.innerHTML = '<span class="eyebrow">Niyetin</span><span class="big"></span><p></p>';
    wish.children[1].textContent = '🌟 ' + fal.wish.big;
    wish.children[2].textContent = fal.wish.text;

    lastText = '☕ Kahve Falım: ' + fal.title + '\n\n' +
      'Semboller: ' + fal.symbols.map((s) => s.icon + ' ' + s.name).join(', ') + '\n\n' +
      fal.sections.map((s) => s.icon + ' ' + s.title + ': ' + s.text).join('\n\n') +
      '\n\n🌟 Niyet: ' + fal.wish.big + ' ' + fal.wish.text;
  }

  // ---------- Akış ----------
  async function handleFile(file) {
    showError('');
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      showError('Lütfen bir fotoğraf seç.');
      return;
    }
    let bmp;
    try {
      bmp = await loadBitmap(file);
    } catch (e) {
      showError('Bu fotoğraf açılamadı. iPhone kullanıyorsan Ayarlar › Kamera › Biçimler › "En Uyumlu" seçip tekrar dene ya da ekran görüntüsü yükle.');
      return;
    }

    const preview = squareCanvas(bmp, 480, 1).toDataURL('image/jpeg', 0.85);
    $('preview').src = preview;
    show('loading');

    const msgs = FAL.loading;
    let i = 0;
    const lt = $('loading-text');
    lt.textContent = msgs[0];
    const timer = setInterval(() => {
      i = (i + 1) % msgs.length;
      lt.style.opacity = 0;
      setTimeout(() => { lt.textContent = msgs[i]; lt.style.opacity = 1; }, 300);
    }, 1100);

    const started = Date.now();
    const fal = compose(analyze(squareCanvas(bmp, 160, 0.86)));
    if (bmp.close) bmp.close();
    const wait = Math.max(0, 4800 - (Date.now() - started));
    setTimeout(() => {
      clearInterval(timer);
      render(fal, preview);
      show('result');
    }, wait);
  }

  ['in-camera', 'in-gallery'].forEach((id) => {
    $(id).addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      e.target.value = '';
    });
  });

  const dz = $('dropzone');
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) dz.classList.remove('drag'); }));
  document.addEventListener('drop', (e) => {
    if ($('screen-home').classList.contains('active')) handleFile(e.dataTransfer.files[0]);
  });

  $('btn-again').addEventListener('click', () => show('home'));

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

  window.__kahveFali = { analyze, compose, handleFile };
})();
