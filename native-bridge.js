/* GanyanSosyal - Android uygulamasinda gorsel indirme/paylasma koprusu.
   Sadece Capacitor (native) icinde calisir, web/PWA surumunu etkilemez. */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var FS = P.Filesystem, SH = P.Share;
  if (!FS || !SH) return;

  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onloadend = function () { res(String(r.result).split(',')[1]); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function safeName(n) { return (n || 'kupon.png').replace(/[^\w.\-]+/g, '_'); }
  function cancelled(e) {
    var m = String((e && (e.message || e)) || '').toLowerCase();
    return m.indexOf('cancel') > -1 || m.indexOf('abort') > -1;
  }
  function abort() { var e = new Error('canceled'); e.name = 'AbortError'; return e; }

  function saveAndShare(blob, name, title, text) {
    return blobToBase64(blob)
      .then(function (b64) {
        return FS.writeFile({ path: safeName(name), data: b64, directory: 'CACHE' });
      })
      .then(function (r) {
        return SH.share({
          title: title || 'GanyanSosyal',
          text: text || '',
          files: [r.uri],
          dialogTitle: 'Kupon görseli'
        });
      })
      .catch(function (e) { throw cancelled(e) ? abort() : e; });
  }

  function uniqueName(n) {
    n = safeName(n || 'kupon.png');
    var i = n.lastIndexOf('.');
    var base = i > 0 ? n.slice(0, i) : n, ext = i > 0 ? n.slice(i) : '.png';
    return base + '_' + Date.now() + ext;
  }
  // Indir: once dogrudan galeriye (Pictures/GanyanSosyal) kaydet, olmazsa paylasim menusu
  function handleAnchor(a) {
    return fetch(a.href)
      .then(function (r) { return r.blob(); })
      .then(function (b) {
        var name = uniqueName(a.download);
        if (window.NativeSave) {
          return blobToBase64(b).then(function (b64) {
            var ok = false;
            try { ok = window.NativeSave.saveImage(b64, name, b.type || 'image/png'); } catch (e) {}
            if (!ok) return saveAndShare(b, name);
          });
        }
        return saveAndShare(b, name);
      })
      .catch(function (e) { if (!cancelled(e)) console.error('Indirme hatasi', e); });
  }
  function isFileLink(a) {
    return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href);
  }

  // a.click() ile kodla tetiklenen indirmeler
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isFileLink(this)) { handleAnchor(this); return; }
    return origClick.apply(this, arguments);
  };
  // DOM'a eklenmis <a download> tiklamalari
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (isFileLink(a)) { e.preventDefault(); e.stopPropagation(); handleAnchor(a); }
  }, true);

  // navigator.share (dosyali paylasim dahil)
  function define(name, fn) {
    try { Object.defineProperty(navigator, name, { value: fn, configurable: true, writable: true }); }
    catch (e) { try { navigator[name] = fn; } catch (_) {} }
  }
  define('canShare', function () { return true; });
  define('share', function (d) {
    d = d || {};
    var f = d.files && d.files[0];
    if (f) return saveAndShare(f, f.name, d.title, d.text);
    return SH.share({ title: d.title, text: d.text, url: d.url })
      .catch(function (e) { throw cancelled(e) ? abort() : e; });
  });
})();
