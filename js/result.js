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
  }

  document.getElementById('btn-retry').addEventListener('click', () => {
    window.location.href = 'puzzle.html';
  });
});