document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || profile.role !== 'admin') {
    alert('Akses ditolak! Halaman ini hanya untuk Administrator.');
    window.location.href = 'dashboard.html';
    return;
  }

  let allAttemptsData = [];

  const searchInput = document.getElementById('search-input');
  const classFilter = document.getElementById('class-filter');
  const sortFilter = document.getElementById('sort-filter');
  const btnLogout = document.getElementById('btn-logout');

  async function loadAdminData() {
    const { data: students } = await supabaseClient.from('profiles').select('*').eq('role', 'student');
    const { data: attempts } = await supabaseClient.from('puzzle_attempts').select('*, profiles(full_name, class_name)').not('completed_at', 'is', null);

    allAttemptsData = attempts || [];

    document.getElementById('stat-total-students').textContent = students ? students.length : 0;
    document.getElementById('stat-total-attempts').textContent = allAttemptsData.length;

    if (allAttemptsData.length > 0) {
      const avg = allAttemptsData.reduce((acc, curr) => acc + Number(curr.score), 0) / allAttemptsData.length;
      document.getElementById('stat-avg-score').textContent = avg.toFixed(2);
    }

    const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))];
    classFilter.innerHTML = '<option value="">Semua Kelas</option>';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classFilter.appendChild(opt);
    });

    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('admin-table-body');
    const searchVal = searchInput.value.toLowerCase();
    const selectedClass = classFilter.value;
    const sortVal = sortFilter.value;

    let filtered = allAttemptsData.filter(item => {
      const nameMatch = item.profiles?.full_name?.toLowerCase().includes(searchVal);
      const classMatch = !selectedClass || item.profiles?.class_name === selectedClass;
      return nameMatch && classMatch;
    });

    filtered.sort((a, b) => {
      if (sortVal === 'newest') return new Date(b.completed_at) - new Date(a.completed_at);
      if (sortVal === 'highest') return b.score - a.score;
      if (sortVal === 'lowest') return a.score - b.score;
      if (sortVal === 'fastest') return a.duration_seconds - b.duration_seconds;
      return 0;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada data pengerjaan</td></tr>';
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const m = String(Math.floor(item.duration_seconds / 60)).padStart(2, '0');
      const s = String(item.duration_seconds % 60).padStart(2, '0');
      const dateStr = new Date(item.completed_at).toLocaleDateString('id-ID');

      tr.innerHTML = `
        <td>${item.profiles?.full_name || '-'}</td>
        <td>${item.profiles?.class_name || '-'}</td>
        <td><strong>${Number(item.score).toFixed(2)}</strong></td>
        <td style="color:green;">${item.correct_answers}</td>
        <td style="color:red;">${item.wrong_answers}</td>
        <td>${m}:${s}</td>
        <td>${dateStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  searchInput.addEventListener('input', renderTable);
  classFilter.addEventListener('change', renderTable);
  sortFilter.addEventListener('change', renderTable);

  btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  loadAdminData();
});