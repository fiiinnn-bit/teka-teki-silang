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

  const GRID_ROWS = 20;
  const GRID_COLS = 23;

  // Pemetaan kata yang presisi sesuai PDF (Kolom 22 = Paling Kanan)
  const PUZZLE_WORDS = [
    { num: 4, dir: 'across', text: 'Ibu', row: 1, col: 12, len: 3 },
    { num: 5, dir: 'across', text: 'Ruang kantor', row: 4, col: 22, len: 10 },
    { num: 9, dir: 'across', text: 'Kamar mandi', row: 6, col: 14, len: 4 },
    { num: 11, dir: 'across', text: 'Kamar tidur', row: 8, col: 22, len: 9 },
    { num: 14, dir: 'across', text: 'Kakak perempuan saya', row: 9, col: 22, len: 14 },
    { num: 16, dir: 'across', text: 'Adik perempuan saya', row: 11, col: 15, len: 14 },
    { num: 17, dir: 'across', text: 'Ayah', row: 14, col: 8, len: 3 },
    { num: 18, dir: 'across', text: 'Dia pergi', row: 15, col: 11, len: 3 },

    { num: 1, dir: 'down', text: 'Pintu gerbang', row: 0, col: 8, len: 5 },
    { num: 2, dir: 'down', text: 'Ruang belajar', row: 0, col: 19, len: 10 },
    { num: 3, dir: 'down', text: 'Saya tidur', row: 1, col: 11, len: 4 },
    { num: 5, dir: 'down', text: 'Ruang tamu', row: 4, col: 18, len: 9 },
    { num: 6, dir: 'down', text: 'Lantai atas', row: 4, col: 3, len: 5 },
    { num: 7, dir: 'down', text: 'Balkon/teras rumah', row: 6, col: 15, len: 4 },
    { num: 8, dir: 'down', text: 'Lantai bawah', row: 6, col: 11, len: 5 },
    { num: 10, dir: 'down', text: 'Dapur', row: 8, col: 21, len: 4 },
    { num: 12, dir: 'down', text: 'Kakak laki-laki saya', row: 9, col: 11, len: 10 },
    { num: 13, dir: 'down', text: 'Ibu rumah tangga', row: 9, col: 7, len: 10 },
    { num: 14, dir: 'down', text: 'Adik laki-laki saya', row: 9, col: 0, len: 10 },
    { num: 15, dir: 'down', text: 'Ruang makan', row: 10, col: 13, len: 10 }
  ];

  const cellMap = {};

  async function init() {
    // 1. Ambil Profil Siswa
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      document.getElementById('student-name').textContent = profile.full_name;
      document.getElementById('student-class').textContent = profile.class_name;
    }

    // 2. Ambil Puzzle ID
    const { data: puzzles } = await supabaseClient.from('puzzles').select('id').limit(1).maybeSingle();
    const puzzleId = puzzles ? puzzles.id : '00000000-0000-0000-0000-000000000001';

    // 3. Ambil Sesi Attempt yang Belum Selesai
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

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        gridEl.appendChild(cell);
      }
    }

    PUZZLE_WORDS.forEach(w => {
      for (let i = 0; i < w.len; i++) {
        let r = w.row + (w.dir === 'down' ? i : 0);
        // Kata mendatar berjalan berkurang kolomnya (kanan ke kiri)
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

      // Nomor ditaruh di kotak awal kata
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