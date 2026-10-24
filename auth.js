// Bitworld Authentication & Session Handler

// Simpan token & user ke LocalStorage browser
function saveSession(token, user) {
  if (token) localStorage.setItem('token', token);
  if (token) localStorage.setItem('bw_token', token);
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('bw_user', JSON.stringify(user));
  }
}

// Ambil data session
function getSessionUser() {
  const userStr = localStorage.getItem('user') || localStorage.getItem('bw_user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

// Periksa status login otomatis saat halaman terbuka
document.addEventListener('DOMContentLoaded', () => {
  const user = getSessionUser();
  if (user) {
    applyLoggedInUI(user);
  }
});

// Update Tampilan jika Sudah Login
function applyLoggedInUI(user) {
  // Sembunyikan modal/form login jika terbuka
  const loginModal = document.getElementById('loginModal') || document.getElementById('auth-modal');
  if (loginModal) loginModal.style.display = 'none';

  // Sembunyikan pesan toast warning
  const toast = document.querySelector('.toast-message, #login-toast');
  if (toast) toast.style.display = 'none';

  // Tampilkan email & balance jika ada elemennya
  const emailElem = document.getElementById('user-email') || document.getElementById('userEmail');
  if (emailElem && user.email) emailElem.innerText = user.email;

  const balanceElem = document.getElementById('user-balance') || document.getElementById('userBalance');
  if (balanceElem && user.balance !== undefined) balanceElem.innerText = user.balance;
}

// Handler Submit Form Login
async function submitLogin(email, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success || data.ok) {
      const token = data.token || data.access_token;
      const user = data.user || data.data;

      // Simpan session permanen di HP
      saveSession(token, user);

      // Refresh halaman agar state ter-update total
      window.location.reload();
    } else {
      alert(data.message || 'Gagal masuk. Periksa email/password.');
    }
  } catch (err) {
    console.error('Error logging in:', err);
    alert('Terjadi kesalahan jaringan/server.');
  }
}
