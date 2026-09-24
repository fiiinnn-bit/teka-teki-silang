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
  const btnDeleteAll = document.getElementById('btn-delete-all');

  const detailModal = document.getElementById('detail-modal');
  const detailModalTitle = document.getElementById('detail-modal-title');
  const detailModalList = document.getElementById('detail-modal-list');
  const detailModalClose = document.getElementById('detail-modal-close');

  // Label soal untuk tampilan rincian (tidak memengaruhi penilaian,
  // yang tetap sepenuhnya dihitung di database).
  const CLUE_TEXT = {
    'across-4': 'Ibu', 'across-5': 'Ruang kantor', 'across-9': 'Kamar mandi',
    'across-11': 'Kamar tidur', 'across-14': 'Kakak perempuan saya',
    'across-16': 'Adik perempuan saya', 'across-17': 'Ayah', 'across-18': 'Dia pergi',
    'down-1': 'Pintu gerbang', 'down-2': 'Ruang belajar', 'down-3': 'Saya tidur',
    'down-5': 'Ruang tamu', 'down-6': 'Lantai atas', 'down-7': 'Balkon/teras rumah',
    'down-8': 'Lantai bawah', 'down-10': 'Dapur', 'down-12': 'Kakak laki-laki saya',
    'down-13': 'Ibu rumah tangga', 'down-14': 'Adik laki-laki saya', 'down-15': 'Ruang makan',
  };

  async function loadAdminData() {
    const { data: students } = await supabaseClient.from('profiles').select('*').eq('role', 'student');
    const { data: attempts } = await supabaseClient.from('puzzle_attempts').select('*, profiles(full_name, class_name)').not('completed_at', 'is', null);

    allAttemptsData = attempts || [];

    document.getElementById('stat-total-students').textContent = students ? students.length : 0;
    document.getElementById('stat-total-attempts').textContent = allAttemptsData.length;

    if (allAttemptsData.length > 0) {
      const avg = allAttemptsData.reduce((acc, curr) => acc + Number(curr.score), 0) / allAttemptsData.length;
      document.getElementById('stat-avg-score').textContent = avg.toFixed(2);
    } else {
      document.getElementById('stat-avg-score').textContent = '0.00';
    }

    const classes = [...new Set((students || []).map(s => s.class_name).filter(Boolean))];
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
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data pengerjaan</td></tr>';
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
        <td>
          <button class="btn btn-info btn-sm btn-detail" data-id="${item.id}" data-name="${item.profiles?.full_name || '-'}">Detail</button>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Pasang event listener untuk tombol yang baru dibuat
    tbody.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => openDetail(btn.dataset.id, btn.dataset.name));
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteAttempt(btn.dataset.id));
    });
  }

  // ---------------- DETAIL BENAR/SALAH PER SOAL ----------------
  async function openDetail(attemptId, studentName) {
    detailModalTitle.textContent = `Rincian Jawaban - ${studentName}`;
    detailModalList.innerHTML = '<li>Memuat...</li>';
    detailModal.classList.remove('hidden');

    const { data: details, error } = await supabaseClient
      .from('puzzle_answers')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('question_number', { ascending: true });

    if (error || !details || details.length === 0) {
      detailModalList.innerHTML = '<li>Tidak ada data rincian untuk pengerjaan ini.</li>';
      return;
    }

    detailModalList.innerHTML = '';
    details.forEach(d => {
      const key = `${d.direction || 'across'}-${d.question_number}`;
      const label = CLUE_TEXT[key] || CLUE_TEXT[`down-${d.question_number}`] || CLUE_TEXT[`across-${d.question_number}`] || `Soal ${d.question_number}`;
      const dirLabel = d.direction === 'down' ? 'Menurun' : 'Mendatar';

      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.borderBottom = '1px solid var(--border-color)';
      li.innerHTML = `
        <span>${d.is_correct ? '✅' : '❌'} <strong>${d.question_number}</strong> (${dirLabel}) — ${label}</span>
        <span style="direction:rtl; font-family:'Amiri', serif; font-size:1.1rem;">${d.user_answer || '(kosong)'}</span>
      `;
      detailModalList.appendChild(li);
    });
  }

  detailModalClose.addEventListener('click', () => detailModal.classList.add('hidden'));
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.add('hidden');
  });

  // ---------------- HAPUS SATU DATA PENGERJAAN ----------------
  async function deleteAttempt(attemptId) {
    if (!confirm('Yakin ingin menghapus data pengerjaan ini? Tindakan ini tidak bisa dibatalkan.')) return;

    const { error } = await supabaseClient.rpc('admin_delete_attempt', { p_attempt_id: attemptId });
    if (error) {
      alert('Gagal menghapus: ' + error.message);
      return;
    }
    await loadAdminData();
  }

  // ---------------- HAPUS SEMUA DATA PENGERJAAN ----------------
  btnDeleteAll.addEventListener('click', async () => {
    if (!confirm('Yakin ingin menghapus SEMUA data pengerjaan siswa? Tindakan ini tidak bisa dibatalkan!')) return;
    if (!confirm('Konfirmasi sekali lagi: SEMUA riwayat nilai akan hilang permanen. Lanjutkan?')) return;

    const { error } = await supabaseClient.rpc('admin_delete_all_attempts');
    if (error) {
      alert('Gagal menghapus semua data: ' + error.message);
      return;
    }
    await loadAdminData();
  });

  searchInput.addEventListener('input', renderTable);
  classFilter.addEventListener('change', renderTable);
  sortFilter.addEventListener('change', renderTable);

  btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  loadAdminData();
});