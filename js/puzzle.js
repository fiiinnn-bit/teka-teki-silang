document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = session.user.id;
  let activeAttempt = null;
  let timerInterval = null;
  let secondsElapsed = 0;
  let currentWord = null;

  // Ukuran grid ini diambil dengan mengukur ulang foto TTS secara presisi
  // (deteksi garis kotak per piksel), sehingga bentuk & posisi setiap kata
  // sekarang identik dengan foto aslinya.
  const GRID_ROWS = 17;
  const GRID_COLS = 33;

  /**
   * MAP HASIL EKSTRAKSI PRESISI DARI FOTO TTS:
   * row: Indeks baris (0-16 dari atas ke bawah)
   * col: Indeks kolom (0-32 dari kiri ke kanan)
   * len: Jumlah kotak/huruf
   *
   * Catatan Penulisan:
   * - Mendatar (across): huruf pertama di (row, col), berjalan MENDATAR KE KIRI (col - i).
   * - Menurun (down): huruf pertama di (row, col), berjalan MENURUN KE BAWAH (row + i).
   *
   * Nomor soal & letak sel awal setiap kata sudah divalidasi lewat algoritma
   * penomoran TTS standar dan cocok 100% dengan nomor pada foto
   * (Across: 4,5,9,11,14,16,17,18 — Down: 1,2,3,5,6,7,8,10,12,13,14,15).
   */
  const PUZZLE_WORDS = [
    // --- ACROSS (MENDATAR) ---
    { num: 4,  dir: 'across', text: 'Ibu',                   row: 2,  col: 20, len: 4 },
    { num: 5,  dir: 'across', text: 'Ruang kantor',          row: 3,  col: 9,  len: 10 },
    { num: 9,  dir: 'across', text: 'Kamar mandi',           row: 5,  col: 19, len: 4 },
    { num: 11, dir: 'across', text: 'Kamar tidur',           row: 6,  col: 12, len: 9 },
    { num: 14, dir: 'across', text: 'Kakak perempuan saya',  row: 7,  col: 32, len: 11 },
    { num: 16, dir: 'across', text: 'Adik perempuan saya',   row: 8,  col: 21, len: 11 },
    { num: 17, dir: 'across', text: 'Ayah',                  row: 12, col: 26, len: 4 },
    { num: 18, dir: 'across', text: 'Dia pergi',             row: 13, col: 23, len: 4 },

    // --- DOWN (MENURUN) ---
    { num: 1,  dir: 'down', text: 'Pintu gerbang',           row: 0, col: 20, len: 5 },
    { num: 2,  dir: 'down', text: 'Ruang belajar',           row: 1, col: 7,  len: 12 },
    { num: 3,  dir: 'down', text: 'Saya tidur',              row: 2, col: 18, len: 4 },
    { num: 5,  dir: 'down', text: 'Ruang tamu',              row: 3, col: 9,  len: 10 },
    { num: 6,  dir: 'down', text: 'Lantai atas',             row: 3, col: 25, len: 12 },
    { num: 7,  dir: 'down', text: 'Balkon/teras rumah',      row: 5, col: 11, len: 4 },
    { num: 8,  dir: 'down', text: 'Lantai bawah',            row: 5, col: 17, len: 12 },
    { num: 10, dir: 'down', text: 'Dapur',                   row: 6, col: 4,  len: 4 },
    { num: 12, dir: 'down', text: 'Kakak laki-laki saya',    row: 7, col: 20, len: 9 },
    { num: 13, dir: 'down', text: 'Ibu rumah tangga',        row: 7, col: 23, len: 8 },
    { num: 14, dir: 'down', text: 'Adik laki-laki saya',     row: 7, col: 32, len: 9 },
    { num: 15, dir: 'down', text: 'Ruang makan',             row: 8, col: 14, len: 9 },
  ];

  const cellMap = {};

  async function init() {
    // Load Profil Siswa
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      document.getElementById('student-name').textContent = profile.full_name;
      document.getElementById('student-class').textContent = profile.class_name;
    }

    // Load Puzzle
    const { data: puzzles } = await supabaseClient.from('puzzles').select('id').limit(1).maybeSingle();
    const puzzleId = puzzles ? puzzles.id : '00000000-0000-0000-0000-000000000001';

    // Session Pengerjaan
    let { data: existingAttempt } = await supabaseClient
      .from('puzzle_attempts')
      .select('*')
      .eq('user_id', userId)
      .is('completed_at', null)
      .maybeSingle();

    if (!existingAttempt) {
      const { data: newAttempt, error } = await supabaseClient
        .from('puzzle_attempts')
        .insert([{ user_id: userId, puzzle_id: puzzleId, duration_seconds: 0 }])
        .select()
        .single();

      if (error) {
        alert('Gagal membuat sesi TTS: ' + error.message);
        return;
      }
      activeAttempt = newAttempt;
    } else {
      activeAttempt = existingAttempt;
      secondsElapsed = activeAttempt.duration_seconds || 0;
    }

    startTimer();
    renderGrid();
    renderClues();
    setupInputs();
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      secondsElapsed++;
      const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const s = String(secondsElapsed % 60).padStart(2, '0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }, 1000);
  }

  function renderGrid() {
    const gridEl = document.getElementById('crossword-grid');
    gridEl.innerHTML = '';

    // Render kotak dasar (grid kosong penuh)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        gridEl.appendChild(cell);
      }
    }

    // Plot kata-kata ke dalam kotak
    PUZZLE_WORDS.forEach(w => {
      for (let i = 0; i < w.len; i++) {
        let r = w.row + (w.dir === 'down' ? i : 0);
        let c = w.col - (w.dir === 'across' ? i : 0);
        const cell = gridEl.querySelector(`[data-row='${r}'][data-col='${c}']`);
        if (cell) {
          cell.classList.add('white');
          if (!cell.querySelector('input')) {
            const input = document.createElement('input');
            input.maxLength = 1;
            input.dataset.row = r;
            input.dataset.col = c;
            cell.appendChild(input);
            cellMap[`${r},${c}`] = input;
          }
        }
      }

      // Pasang Nomor Soal di Kotak Awal Kata (kanan untuk across, atas untuk down)
      const numCell = gridEl.querySelector(`[data-row='${w.row}'][data-col='${w.col}']`);
      if (numCell && !numCell.querySelector('.cell-number')) {
        const numSpan = document.createElement('span');
        numSpan.className = 'cell-number';
        numSpan.textContent = w.num;
        numCell.appendChild(numSpan);
      }
    });
  }

  function renderClues() {
    const acrossEl = document.getElementById('clues-across');
    const downEl = document.getElementById('clues-down');
    acrossEl.innerHTML = '';
    downEl.innerHTML = '';

    PUZZLE_WORDS.forEach(w => {
      const li = document.createElement('li');
      li.textContent = `${w.num}. ${w.text}`;
      li.dataset.num = w.num;
      li.dataset.dir = w.dir;
      li.addEventListener('click', () => {
        highlightWord(w);
        const firstCell = cellMap[`${w.row},${w.col}`];
        if (firstCell) firstCell.focus();
      });
      if (w.dir === 'across') acrossEl.appendChild(li);
      else downEl.appendChild(li);
    });
  }

  function highlightWord(wordObj) {
    currentWord = wordObj;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active-cell', 'highlight-word'));
    document.querySelectorAll('.clues-list li').forEach(l => l.classList.remove('active-clue'));

    const clueLi = document.querySelector(`.clues-list li[data-num='${wordObj.num}'][data-dir='${wordObj.dir}']`);
    if (clueLi) clueLi.classList.add('active-clue');

    for (let i = 0; i < wordObj.len; i++) {
      let r = wordObj.row + (wordObj.dir === 'down' ? i : 0);
      let c = wordObj.col - (wordObj.dir === 'across' ? i : 0);
      const cell = document.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
      if (cell) cell.classList.add('highlight-word');
    }
  }

  function setupInputs() {
    Object.keys(cellMap).forEach(key => {
      const input = cellMap[key];
      const [r, c] = key.split(',').map(Number);

      input.addEventListener('focus', () => {
        document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('active-cell'));
        input.parentElement.classList.add('active-cell');
        if (!currentWord) {
          const w = PUZZLE_WORDS.find(word => {
            if (word.dir === 'across' && word.row === r && c <= word.col && c > word.col - word.len) return true;
            if (word.dir === 'down' && word.col === c && r >= word.row && r < word.row + word.len) return true;
            return false;
          });
          if (w) highlightWord(w);
        }
      });

      input.addEventListener('input', (e) => {
        const val = e.target.value;
        const arabicRegex = /^[\u0600-\u06FF]$/;
        // Hanya menerima karakter Unicode Arab
        if (!arabicRegex.test(val)) {
          e.target.value = '';
          return;
        }
        if (currentWord) {
          moveToNextCell(r, c);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value) {
          moveToPrevCell(r, c);
        }
      });
    });
  }

  function moveToNextCell(r, c) {
    if (!currentWord) return;
    let nextR = r + (currentWord.dir === 'down' ? 1 : 0);
    let nextC = c - (currentWord.dir === 'across' ? 1 : 0);
    const nextInput = cellMap[`${nextR},${nextC}`];
    if (nextInput) nextInput.focus();
  }

  function moveToPrevCell(r, c) {
    if (!currentWord) return;
    let prevR = r - (currentWord.dir === 'down' ? 1 : 0);
    let prevC = c + (currentWord.dir === 'across' ? 1 : 0);
    const prevInput = cellMap[`${prevR},${prevC}`];
    if (prevInput) {
      prevInput.focus();
      prevInput.value = '';
    }
  }

  document.getElementById('btn-submit').addEventListener('click', async () => {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) return;
    clearInterval(timerInterval);

    const userAnswers = PUZZLE_WORDS.map(w => {
      let wordStr = '';
      for (let i = 0; i < w.len; i++) {
        let r = w.row + (w.dir === 'down' ? i : 0);
        let c = w.col - (w.dir === 'across' ? i : 0);
        const inp = cellMap[`${r},${c}`];
        wordStr += inp && inp.value ? inp.value : ' ';
      }
      return {
        question_number: w.num,
        direction: w.dir,
        answer: wordStr.trim()
      };
    });

    const { data, error } = await supabaseClient.rpc('check_puzzle_answers', {
      p_attempt_id: activeAttempt.id,
      p_user_answers: userAnswers,
      p_duration: secondsElapsed
    });

    if (error) {
      alert('Gagal mengirim jawaban: ' + error.message);
    } else {
      window.location.href = 'result.html';
    }
  });

  init();
});