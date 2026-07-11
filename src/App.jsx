import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import PrepTracker from './PrepTracker';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = 加载中, null = 未登录
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSendLink(e) {
    e.preventDefault();
    setAuthError('');
    if (!email.trim()) return setAuthError('请输入邮箱');
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) return setAuthError(error.message);
    setSent(true);
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
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.title}>我的备考基地</div>
          <div style={styles.sub}>输入邮箱，获取登录链接</div>
          {sent ? (
            <div style={{ color: '#6fcf97', marginTop: 16, fontSize: 14 }}>
              登录链接已发送到 {email}，请去邮箱点击链接完成登录。
            </div>
          ) : (
            <form onSubmit={handleSendLink} style={{ marginTop: 16 }}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
              <button type="submit" disabled={sending} style={styles.btn}>
                {sending ? '发送中…' : '发送登录链接'}
              </button>
              {authError && <div style={{ color: '#e2685a', marginTop: 10, fontSize: 13 }}>{authError}</div>}
            </form>
          )}
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
    width: '100%', marginTop: 10, background: '#f2a93c', color: '#1a1305', border: 'none',
    padding: '10px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
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
