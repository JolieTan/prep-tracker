import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import PrepTracker from './PrepTracker';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function resetFormMessages() {
    setAuthError('');
    setAuthNotice('');
  }

  function switchMode(next) {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    resetFormMessages();
  }

  async function handleSignIn(e) {
    e.preventDefault();
    resetFormMessages();
    if (!email.trim() || !password) return setAuthError('请输入邮箱和密码');
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) return setAuthError('邮箱或密码不对，再试一次');
  }

  async function handleSignUp(e) {
    e.preventDefault();
    resetFormMessages();
    if (!email.trim() || !password) return setAuthError('请输入邮箱和密码');
    if (password.length < 6) return setAuthError('密码至少 6 位');
    if (password !== confirmPassword) return setAuthError('两次输入的密码不一致');
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setSubmitting(false);
    if (error) return setAuthError(error.message.includes('already registered') ? '这个邮箱已经注册过了，试试登录' : error.message);
    if (data.session) {
      return;
    }
    setAuthNotice('注册成功，请去邮箱点击确认链接后再登录。');
    switchMode('signin');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (session === undefined) {
    return (
      <div style={styles.center}>
        <div style={styles.dim}>加载中…</div>
      </div>
    );
  }

  if (!session) {
    const isSignUp = mode === 'signup';
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.title}>我的备考基地</div>
          <div style={styles.sub}>{isSignUp ? '注册一个新账号' : '登录你的账号'}</div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} style={{ marginTop: 16 }}>
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...styles.input, marginTop: 10 }}
            />
            {isSignUp && (
              <input
                type="password"
                placeholder="再输入一次密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ ...styles.input, marginTop: 10 }}
              />
            )}
            <button type="submit" disabled={submitting} style={styles.btn}>
              {submitting ? '处理中…' : isSignUp ? '注册' : '登录'}
            </button>
            {authError && <div style={{ color: '#e2685a', marginTop: 10, fontSize: 13 }}>{authError}</div>}
            {authNotice && <div style={{ color: '#6fcf97', marginTop: 10, fontSize: 13 }}>{authNotice}</div>}
          </form>

          <div style={{ marginTop: 16, fontSize: 13, color: '#9098b5', textAlign: 'center' }}>
            {isSignUp ? (
              <>已经有账号？<a href="#" onClick={(e) => { e.preventDefault(); switchMode('signin'); }} style={styles.link}>去登录</a></>
            ) : (
              <>还没有账号？<a href="#" onClick={(e) => { e.preventDefault(); switchMode('signup'); }} style={styles.link}>去注册</a></>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.topbar}>
        <span style={{ opacity: 0.7 }}>{session.user.email}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>退出登录</button>
      </div>
      <PrepTracker />
    </div>
  );
}

const styles = {
  center: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0e1220', color: '#ece8dc', fontFamily: '-apple-system, "PingFang SC", sans-serif',
  },
  dim: { color: '#9098b5' },
  card: {
    background: '#171c2e', border: '1px solid #2a3150', borderRadius: 16,
    padding: '32px 28px', width: 320,
  },
  title: { fontSize: 20, fontFamily: 'Georgia, "Noto Serif SC", serif' },
  sub: { fontSize: 13, color: '#9098b5', marginTop: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', background: '#1f2540', border: '1px solid #2a3150',
    color: '#ece8dc', padding: '10px 12px', borderRadius: 8, fontSize: 14,
  },
  btn: {
    width: '100%', marginTop: 14, background: '#f2a93c', color: '#1a1305', border: 'none',
    padding: '10px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
  link: { color: '#f2a93c', marginLeft: 4 },
  topbar: {
    position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'flex-end',
    alignItems: 'center', gap: 12, padding: '8px 20px', background: '#0e1220',
    color: '#ece8dc', fontSize: 13, borderBottom: '1px solid #2a3150',
  },
  logoutBtn: {
    background: 'none', border: '1px solid #2a3150', color: '#9098b5', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  },
};
