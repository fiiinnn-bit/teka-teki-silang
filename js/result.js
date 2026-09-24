document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = session.user.id;

  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (profile) {
    document.getElementById('res-name').textContent = profile.full_name;
    document.getElementById('res-class').textContent = profile.class_name;
  }

  const { data: attempt } = await supabaseClient
    .from('puzzle_attempts')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (attempt) {
    document.getElementById('res-correct').textContent = attempt.correct_answers;
    document.getElementById('res-wrong').textContent = attempt.wrong_answers;
    document.getElementById('res-score').textContent = Number(attempt.score).toFixed(2);

    const m = String(Math.floor(attempt.duration_seconds / 60)).padStart(2, '0');
    const s = String(attempt.duration_seconds % 60).padStart(2, '0');
    document.getElementById('res-duration').textContent = `${m}:${s}`;

    // ---- Rincian benar/salah per nomor soal ----
    // Ambil dari puzzle_answers, yang sudah otomatis diisi oleh
    // check_puzzle_answers setiap kali siswa submit.
    const { data: details } = await supabaseClient
      .from('puzzle_answers')
      .select('*')
      .eq('attempt_id', attempt.id)
      .order('question_number', { ascending: true });

    if (details && details.length) {
      renderBreakdown(details);
    }
  }

  document.getElementById('btn-retry').addEventListener('click', () => {
    window.location.href = 'puzzle.html';
  });
});

// Teks soal dipakai hanya untuk label tampilan (tidak memengaruhi penilaian,
// yang tetap sepenuhnya dihitung di server/database).
const CLUE_TEXT = {
  'across-4': 'Ibu', 'across-5': 'Ruang kantor', 'across-9': 'Kamar mandi',
  'across-11': 'Kamar tidur', 'across-14': 'Kakak perempuan saya',
  'across-16': 'Adik perempuan saya', 'across-17': 'Ayah', 'across-18': 'Dia pergi',
  'down-1': 'Pintu gerbang', 'down-2': 'Ruang belajar', 'down-3': 'Saya tidur',
  'down-5': 'Ruang tamu', 'down-6': 'Lantai atas', 'down-7': 'Balkon/teras rumah',
  'down-8': 'Lantai bawah', 'down-10': 'Dapur', 'down-12': 'Kakak laki-laki saya',
  'down-13': 'Ibu rumah tangga', 'down-14': 'Adik laki-laki saya', 'down-15': 'Ruang makan',
};

function renderBreakdown(details) {
  const wrap = document.createElement('div');
  wrap.className = 'mt-4';
  wrap.innerHTML = '<h3 class="mt-3 mb-2" style="text-align:left;">Rincian Jawaban</h3>';

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.textAlign = 'left';
  list.style.padding = '0';

  details.forEach(d => {
    // direction tidak disimpan di puzzle_answers, jadi kita coba cocokkan
    // ke dua kemungkinan (across/down) berdasarkan question_number saja
    // untuk label; ini hanya untuk tampilan, tidak memengaruhi skor.
    const label =
      CLUE_TEXT[`across-${d.question_number}`] ||
      CLUE_TEXT[`down-${d.question_number}`] ||
      `Soal ${d.question_number}`;

    const li = document.createElement('li');
    li.style.padding = '6px 4px';
    li.style.borderBottom = '1px solid var(--border-color)';
    li.innerHTML = `
      <span style="margin-right:8px;">${d.is_correct ? '✅' : '❌'}</span>
      <strong>${d.question_number}.</strong> ${label}
      <span style="float:right; direction:rtl; font-family:'Amiri', serif;">${d.user_answer || ''}</span>
    `;
    list.appendChild(li);
  });

  wrap.appendChild(list);
  document.querySelector('.result-details').appendChild(wrap);
}