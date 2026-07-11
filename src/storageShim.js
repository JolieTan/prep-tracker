import { supabase } from './supabaseClient';

// 这个文件在 window 上模拟出了 Claude 网页版 Artifact 里那套 window.storage API
// （get / set / delete / list），底层改成读写 Supabase 的 kv_store 表。
// 这样 PrepTracker.jsx 组件本身完全不用改动，照样调用 window.storage.get / .set。
//
// 数据按 Supabase 登录用户的 user_id 隔离，配合下面 SQL 里的 RLS 策略，
// 保证每个人只能读写自己的数据。

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

window.storage = {
  async get(key /*, shared */) {
    const userId = await getUserId();
    if (!userId) throw new Error('未登录');
    const { data, error } = await supabase
      .from('kv_store')
      .select('value')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: data.value, shared: false };
  },

  async set(key, value /*, shared */) {
    const userId = await getUserId();
    if (!userId) throw new Error('未登录');
    const { error } = await supabase
      .from('kv_store')
      .upsert(
        { user_id: userId, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    if (error) throw error;
    return { key, value, shared: false };
  },

  async delete(key /*, shared */) {
    const userId = await getUserId();
    if (!userId) throw new Error('未登录');
    const { error } = await supabase
      .from('kv_store')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);
    if (error) throw error;
    return { key, deleted: true, shared: false };
  },

  async list(prefix /*, shared */) {
    const userId = await getUserId();
    if (!userId) throw new Error('未登录');
    let q = supabase.from('kv_store').select('key').eq('user_id', userId);
    if (prefix) q = q.like('key', `${prefix}%`);
    const { data, error } = await q;
    if (error) throw error;
    return { keys: (data || []).map((d) => d.key), prefix, shared: false };
  },
};
