document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const alertEl = document.getElementById('alert');

  function showAlert(msg, type = 'danger') {
    alertEl.textContent = msg;
    alertEl.className = `alert alert-${type}`;
    alertEl.classList.remove('hidden');
  }

  // --- LOGIK LOGIN ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btnSubmit = document.getElementById('btn-submit');

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Memproses...';

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        showAlert('Login gagal: ' + error.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Masuk';
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }

  // --- LOGIK REGISTRASI (DIPERBAIKI) ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('full_name').value.trim();
      const className = document.getElementById('class_name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btnSubmit = document.getElementById('btn-submit');

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Memproses...';

      // Kirim data metadata agar otomatis ditangkap Trigger SQL
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            class_name: className
          }
        }
      });

      if (authError) {
        showAlert('Registrasi gagal: ' + authError.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Daftar Akun';
        return;
      }

      showAlert('Registrasi berhasil! Silakan masuk.', 'success');
      setTimeout(() => { 
        window.location.href = 'login.html'; 
      }, 1500);
    });
  }
});