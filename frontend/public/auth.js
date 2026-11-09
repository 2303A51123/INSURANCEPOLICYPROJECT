/**
 * Login / Register page logic
 * Insurance Policy and Claims Management System
 * Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123
 */
(function () {
  const TOKEN_KEY = 'insursync_token';
  const USER_KEY = 'insursync_user';

  function store(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* storage unavailable */ }
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
  }

  // Already signed in? Skip straight to the application.
  const existing = getToken();
  if (existing) {
    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + existing } })
      .then(r => { if (r.ok) window.location.replace('/'); else clearSession(); })
      .catch(() => {});
  }

  const form = document.getElementById('authForm');
  if (!form) return;
  const mode = form.dataset.mode; // 'login' | 'register'
  const alertBox = document.getElementById('alertBox');
  const submitBtn = document.getElementById('submitBtn');

  function showAlert(msg, ok) {
    alertBox.textContent = (ok ? '✅ ' : '⚠️ ') + msg;
    alertBox.classList.toggle('ok', !!ok);
    alertBox.classList.remove('show');
    void alertBox.offsetWidth; // restart animation
    alertBox.classList.add('show');
  }
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  // Show / hide password
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  // Password strength meter (register only)
  const pw = document.getElementById('password');
  const meter = document.getElementById('strength');
  if (mode === 'register' && pw && meter) {
    const colors = ['#f43f5e', '#f59e0b', '#38bdf8', '#10b981'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    pw.addEventListener('input', () => {
      const v = pw.value;
      meter.classList.toggle('show', v.length > 0);
      let score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
      const level = Math.max(1, score);
      meter.querySelectorAll('.bars span').forEach((bar, i) => {
        bar.style.background = i < level ? colors[level - 1] : '';
      });
      const label = meter.querySelector('.label');
      label.textContent = 'Password strength: ' + labels[level - 1];
      label.style.color = colors[level - 1];
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.remove('show');
    form.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));

    const payload = {};
    new FormData(form).forEach((v, k) => { payload[k] = v; });

    if (mode === 'register') {
      if (payload.password !== payload.confirm) {
        document.getElementById('confirm').classList.add('invalid');
        return showAlert('Passwords do not match.');
      }
      delete payload.confirm;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        return showAlert(data.error || 'Something went wrong. Please try again.');
      }
      store(data.token, data.user);
      showAlert(mode === 'register' ? 'Account created! Opening your workspace…' : 'Welcome back! Opening your workspace…', true);
      setTimeout(() => window.location.replace('/'), 700);
    } catch (err) {
      setLoading(false);
      showAlert('Cannot reach the server. Please check that it is running.');
    }
  });
})();
