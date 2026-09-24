document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = session.user.id;
  const btnLogout = document.getElementById('btn-logout');
  const btnStart = document.getElementById('btn-start');
  const btnContinue = document.getElementById('btn-continue');
  const btnResult = document.getElementById('btn-result');
  const btnAdminLink = document.getElementById('btn-admin-link');

  // Ambil profil siswa secara aman
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    document.getElementById('student-name').textContent = profile.full_name;
    document.getElementById('student-class').textContent = profile.class_name;
    if (profile.role === 'admin') {
      btnAdminLink.classList.remove('hidden');
    }
  } else {
    document.getElementById('student-name').textContent = session.user.email;
    document.getElementById('student-class').textContent = '-';
  }

  // Ambil histori pengerjaan
  const { data: attempts } = await supabaseClient
    .from('puzzle_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (attempts && attempts.length > 0) {
    const latestAttempt = attempts[0];
    if (latestAttempt.completed_at) {
      document.getElementById('student-status').textContent = 'Selesai';
      document.getElementById('student-status').className = 'badge bg-success';
      document.getElementById('student-score').textContent = `${Number(latestAttempt.score).toFixed(2)} / 100`;
      
      btnStart.textContent = 'KERJAKAN ULANG';
      btnResult.classList.remove('hidden');
    } else {
      document.getElementById('student-status').textContent = 'Sedang dikerjakan';
      document.getElementById('student-status').className = 'badge bg-warning';
      btnStart.classList.add('hidden');
      btnContinue.classList.remove('hidden');
    }
  }

  btnStart.addEventListener('click', () => { window.location.href = 'puzzle.html'; });
  btnContinue.addEventListener('click', () => { window.location.href = 'puzzle.html'; });
  btnResult.addEventListener('click', () => { window.location.href = 'result.html'; });

  btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
});