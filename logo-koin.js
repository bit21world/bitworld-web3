(function () {
  /* Logo koin di halaman Mining (koin besar + titik kecil): memakai logo baru Bitworld.
     Gambar diambil dari /btw-logo-256.png (pastikan file itu ada di folder yang sama dengan index.html). */
  var css = 'html body{--btw-logo:url("/btw-logo-256.png")}' +
    'html body .mn-coin{width:84px!important;height:84px!important;background:var(--btw-logo) center/cover no-repeat!important;color:transparent!important;font-size:0!important;box-shadow:0 8px 18px rgba(0,20,80,.45)!important;border-radius:50%!important}' +
    'html body .mn-dot{background:var(--btw-logo) center/cover no-repeat!important;box-shadow:0 3px 8px rgba(0,20,80,.35);border-radius:50%!important}';
  var st = document.createElement("style");
  st.id = "logo-koin";
  st.textContent = css;
  document.head.appendChild(st);
})();
