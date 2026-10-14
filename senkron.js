/* BR ADA otomatik senkron - yer imi (bookmarklet) ile çalışır, eklenti gerekmez.
   Kurulum: bu dosya GitHub repo'da durur, yer imi bunu çağırır.
   İlk tıklamada GitHub token sorar (bir kez), tarayıcıda saklar. */
(function () {
  'use strict';
  var GITHUB_USER = 'rizasahin09-commits';
  var GITHUB_REPO = 'brada-ilanlar';
  var GITHUB_PATH = 'ilanlar.json';
  var GITHUB_BRANCH = 'main';

  function rozet(metin, renk) {
    var el = document.getElementById('brada-sync-rozet');
    if (!el) {
      el = document.createElement('div');
      el.id = 'brada-sync-rozet';
      el.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:99999;background:#111417;color:#F0D488;font:13px Arial;padding:10px 14px;border-radius:12px;border:1px solid #DBBC6D;box-shadow:0 4px 16px rgba(0,0,0,.3)';
      document.body.appendChild(el);
    }
    el.style.borderColor = renk || '#DBBC6D';
    el.textContent = metin;
  }

  function tipBul(b, link) {
    var t = ((b || '') + ' ' + (link || '')).toLocaleLowerCase('tr');
    return t.indexOf('kiralik') !== -1 ? 'Kiralık' : 'Satılık';
  }
  function kategoriBul(b, link) {
    var t = ((b || '') + ' ' + (link || '')).toLocaleLowerCase('tr');
    if (t.indexOf('dukkan') !== -1 || t.indexOf('magaza') !== -1 || t.indexOf('is-yeri') !== -1) return 'İş Yeri';
    if (t.indexOf('rezidans') !== -1) return 'Rezidans';
    if (t.indexOf('arsa') !== -1 || t.indexOf('tarla') !== -1) return 'Arsa';
    return 'Daire';
  }

  function ilanlariCek() {
    var map = {};
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) {
      var alt = im.getAttribute('alt') || '';
      var src = im.currentSrc || im.src || '';
      var m = alt.match(/#(\d{6,})/);
      if (m && src.indexOf('shbdn') !== -1 && src.indexOf('assets') === -1) {
        var id = m[1];
        if (!map[id]) map[id] = { id: id, img: src, baslik: alt.replace(/#\d+.*$/, '').trim() };
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="/ilan/"]'), function (a) {
      var mm = a.href.match(/-(\d{6,})\/detay/);
      if (!mm) return;
      var id = mm[1];
      if (!map[id]) map[id] = { id: id, link: a.href, baslik: (a.innerText || '').trim().slice(0, 120) };
      else if (!map[id].link) map[id].link = a.href;
    });
    var lines = document.body.innerText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var out = Object.keys(map).map(function (id) {
      var v = map[id];
      var fiyat = '', konum = 'Aydın / Kuşadası';
      var kisa = (v.baslik || '').slice(0, 22);
      var idx = -1;
      for (var i = 0; i < lines.length; i++) { if (kisa && lines[i].indexOf(kisa) !== -1) { idx = i; break; } }
      if (idx !== -1) {
        for (var j = idx; j < Math.min(lines.length, idx + 8); j++) {
          if (/^[\d\.]+ TL$/.test(lines[j])) { fiyat = lines[j]; break; }
          if (lines[j].indexOf('Aydın /') !== -1) konum = lines[j];
        }
      }
      // çok fotoğraflı liste: sayfadaki tüm thmb'leri ilana dağıt
      var hepsi = [];
      Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) {
        var s = im.currentSrc || im.src || '';
        if (s.indexOf('shbdn') !== -1 && s.indexOf('/thmb_') !== -1 && s.indexOf(id) !== -1) hepsi.push(s);
      });
      var fotos = hepsi.length ? hepsi.slice(0, 12) : (v.img ? [v.img] : []);
      return {
        id: Number(id), tip: tipBul(v.baslik, v.link), kategori: kategoriBul(v.baslik, v.link),
        fiyat: fiyat, baslik: v.baslik || ('İlan ' + id), detay: 'İlan No: ' + id,
        konum: konum, img: fotos[0] || '', fotos: fotos, link: v.link || '',
        aciklama: 'İlan No: ' + id + ' | ' + konum
      };
    });
    out.sort(function (a, b) { return a.id - b.id; });
    return out;
  }

  function api(url, method, token, data) {
    return fetch(url, {
      method: method,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('GitHub ' + r.status);
      return r.json();
    });
  }

  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  async function calistir() {
    try {
      rozet('⏳ BR ADA senkron çalışıyor...');
      var token = '';
      try { token = localStorage.getItem('brada_gh_token') || ''; } catch (e) {}
      if (!token) {
        token = prompt('GitHub tokenını yapıştır (bir kez sorulur, bu tarayıcıda saklanır):', '');
        if (!token) { rozet('⚠ Token girilmedi', 'red'); return; }
        try { localStorage.setItem('brada_gh_token', token.trim()); } catch (e) {}
        token = token.trim();
      }
      var ilanlar = ilanlariCek();
      if (!ilanlar.length) { rozet('⚠ Bu sayfada ilan bulunamadı', 'red'); return; }
      var meta = await api('https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + GITHUB_PATH + '?ref=' + GITHUB_BRANCH, 'GET', token).catch(function () { return null; });
      var payload = { updatedAt: new Date().toISOString(), source: 'https://bradagayrimenkul.sahibinden.com/', count: ilanlar.length, ilanlar: ilanlar };
      await api('https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + GITHUB_PATH, 'PUT', token, {
        message: 'otomatik senkron ' + new Date().toLocaleString('tr-TR'),
        content: b64(JSON.stringify(payload, null, 2)),
        sha: meta && meta.sha ? meta.sha : undefined,
        branch: GITHUB_BRANCH
      });
      rozet('✓ Senkron tamam (' + ilanlar.length + ' ilan) ' + new Date().toLocaleTimeString('tr-TR'), '#4caf50');
    } catch (e) {
      var m = String((e && e.message) || e);
      if (m.indexOf('401') !== -1) {
        try { localStorage.removeItem('brada_gh_token'); } catch (x) {}
        rozet('❌ Token hatalı, tekrar tıkla ve doğru tokenı gir', 'red');
      } else {
        rozet('❌ Hata: ' + m.slice(0, 100), 'red');
      }
    }
  }

  calistir();
})();
