import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import {
  Flame, Clock3, Target, Trash2, BookOpenCheck, Plus,
  LayoutDashboard, Briefcase, Mic, Play, Pause, RotateCcw, Square, Pencil, X
} from 'lucide-react';

const STORAGE_KEY = 'prep-tracker-v2';

const SUBJECTS = ['Quant 数学', 'Verbal 语文', 'Data Insights 数据洞察', '模拟考试', '其他'];

const SUBJECT_COLORS = {
  'Quant 数学': '#4fb6c0',
  'Verbal 语文': '#f2a93c',
  'Data Insights 数据洞察': '#9b8cf2',
  '模拟考试': '#e2685a',
  '其他': '#9098b5',
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL = { easy: '简单', medium: '中等', hard: '困难' };
const DIFFICULTY_COLOR = { easy: '#6fcf97', medium: '#f2a93c', hard: '#e2685a' };

// GMAT Focus Edition 官方单科标准：题数 / 时长（分钟）
const BENCHMARK = {
  'Quant 数学': { q: 21, m: 45 },
  'Verbal 语文': { q: 23, m: 45 },
  'Data Insights 数据洞察': { q: 20, m: 45 },
};

const DEFAULT_TOPICS = [
  { id: 't1', name: '算术 Arithmetic', category: 'Quant' },
  { id: 't2', name: '代数 Algebra', category: 'Quant' },
  { id: 't3', name: '应用题 Word Problems', category: 'Quant' },
  { id: 't4', name: 'Sentence Correction (SC)', category: 'Verbal' },
  { id: 't5', name: 'Critical Reasoning (CR)', category: 'Verbal' },
  { id: 't6', name: 'Reading Comprehension (RC)', category: 'Verbal' },
  { id: 't7', name: '图表分析 Graphics Interpretation', category: 'Data Insights' },
  { id: 't8', name: '双源分析 Two-Part Analysis', category: 'Data Insights' },
  { id: 't9', name: '表格分析 Table Analysis', category: 'Data Insights' },
].map((t) => ({ ...t, mastery: 0, done: false }));

const CONSULTING_TYPE_LABEL = { speaking: '英文口语练习', case: 'Case 案例分析' };
const CONSULTING_TYPE_COLOR = { speaking: '#4fb6c0', case: '#9b8cf2' };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function fmtMinutes(total) {
  const t = Math.round(total);
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h <= 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

function fmtClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function computeStreak(dateObjs) {
  const dateSet = new Set(dateObjs.map((s) => s.date));
  if (dateSet.size === 0) return 0;
  let streak = 0;
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  let skippedToday = false;
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dateSet.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (ds === todayStr() && !skippedToday) {
      skippedToday = true;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function gmatDailyMinutes(practiceSets, freeStudySessions, ds) {
  const setMin = practiceSets.filter((s) => s.date === ds).reduce((a, s) => a + Number(s.durationMin || 0), 0);
  const freeMin = freeStudySessions.filter((s) => s.date === ds).reduce((a, s) => a + Number(s.durationSec || 0) / 60, 0);
  return Math.round((setMin + freeMin) * 10) / 10;
}

function last14DaysGmat(practiceSets, freeStudySessions) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds.slice(5), minutes: gmatDailyMinutes(practiceSets, freeStudySessions, ds) });
  }
  return days;
}

function overviewWeekSplit(practiceSets, freeStudySessions, consultingSessions) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const gmat = gmatDailyMinutes(practiceSets, freeStudySessions, ds);
    const consulting = consultingSessions.filter((s) => s.date === ds).reduce((a, s) => a + Number(s.durationMin || 0), 0);
    days.push({ date: ds.slice(5), GMAT: gmat, 咨询面试: Math.round(consulting * 10) / 10 });
  }
  return days;
}

function last70Days(practiceSets, freeStudySessions) {
  const days = [];
  for (let i = 69; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, minutes: gmatDailyMinutes(practiceSets, freeStudySessions, ds) });
  }
  return days;
}

function accuracyTrend(practiceSets) {
  const sorted = [...practiceSets].sort((a, b) => (a.date > b.date ? 1 : -1));
  return sorted.slice(-20).map((s, idx) => ({
    name: `${s.date.slice(5)} #${idx + 1}`,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
  }));
}

function subjectStats(practiceSets) {
  const map = {};
  SUBJECTS.forEach((s) => (map[s] = { subject: s, minutes: 0, total: 0, correct: 0 }));
  practiceSets.forEach((s) => {
    if (!map[s.subject]) map[s.subject] = { subject: s.subject, minutes: 0, total: 0, correct: 0 };
    map[s.subject].minutes += Number(s.durationMin || 0);
    map[s.subject].total += Number(s.total || 0);
    map[s.subject].correct += Number(s.correct || 0);
  });
  return Object.values(map)
    .filter((m) => m.minutes > 0 || m.total > 0)
    .map((m) => ({ ...m, accuracy: m.total > 0 ? Math.round((m.correct / m.total) * 1000) / 10 : 0 }));
}

function difficultyStats(practiceSets) {
  return DIFFICULTIES.map((d) => {
    const rel = practiceSets.filter((s) => (s.difficulty || 'medium') === d);
    const total = rel.reduce((a, s) => a + Number(s.total || 0), 0);
    const correct = rel.reduce((a, s) => a + Number(s.correct || 0), 0);
    return {
      difficulty: DIFFICULTY_LABEL[d],
      key: d,
      count: rel.length,
      accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    };
  }).filter((d) => d.count > 0);
}

function pacingBySubject(practiceSets) {
  const out = [];
  Object.keys(BENCHMARK).forEach((subj) => {
    const relevant = practiceSets.filter((s) => s.subject === subj && Number(s.total) > 0);
    if (relevant.length === 0) return;
    const totalQ = relevant.reduce((a, s) => a + Number(s.total), 0);
    const totalMin = relevant.reduce((a, s) => a + Number(s.durationMin), 0);
    const yourPace = totalMin / totalQ;
    const stdPace = BENCHMARK[subj].m / BENCHMARK[subj].q;
    out.push({
      subject: subj,
      yourPaceSec: Math.round(yourPace * 60),
      stdPaceSec: Math.round(stdPace * 60),
      deltaSec: Math.round((yourPace - stdPace) * 60),
      sessionsCount: relevant.length,
    });
  });
  return out;
}

function consultingSeries(consultingSessions, type) {
  return [...consultingSessions]
    .filter((s) => s.type === type)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-15)
    .map((s, idx) => ({ name: `${s.date.slice(5)} #${idx + 1}`, rating: s.rating }));
}

function Dots({ value, onChange, size = 14 }) {
  return (
    <div className="gt-dots">
      {[1, 2, 3, 4, 5].map((lvl) => (
        <div
          key={lvl}
          className={`gt-dot ${value >= lvl ? 'active' : ''}`}
          style={{ width: size, height: size }}
          onClick={() => onChange(value === lvl ? lvl - 1 : lvl)}
          title={`${lvl}/5`}
        />
      ))}
    </div>
  );
}

function Stopwatch({ label, accent, onUse, useLabel, extra }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="gt-timer-card" style={{ borderColor: accent }}>
      <div className="gt-timer-label" style={{ color: accent }}>{label}</div>
      <div className="gt-timer-display gt-mono">{fmtClock(seconds)}</div>
      {extra}
      <div className="gt-timer-controls">
        {!running ? (
          <button type="button" className="gt-btn-sm" onClick={() => setRunning(true)}>
            <Play size={13} /> {seconds > 0 ? '继续' : '开始'}
          </button>
        ) : (
          <button type="button" className="gt-btn-sm" onClick={() => setRunning(false)}>
            <Pause size={13} /> 暂停
          </button>
        )}
        <button
          type="button"
          className="gt-btn-sm gt-btn-ghost"
          onClick={() => { setRunning(false); setSeconds(0); }}
        >
          <RotateCcw size={13} /> 重置
        </button>
        <button
          type="button"
          className="gt-btn-sm gt-btn-primary"
          style={{ background: accent }}
          disabled={seconds === 0}
          onClick={() => { onUse(seconds); setRunning(false); setSeconds(0); }}
        >
          <Square size={13} /> {useLabel || '停止并使用'}
        </button>
      </div>
    </div>
  );
}

export default function PrepTracker() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('overview');

  const [practiceSets, setPracticeSets] = useState([]);
  const [freeStudySessions, setFreeStudySessions] = useState([]);
  const [examDate, setExamDate] = useState('');
  const [topics, setTopics] = useState(DEFAULT_TOPICS);

  const [consultingSessions, setConsultingSessions] = useState([]);
  const [interviewDate, setInterviewDate] = useState('');

  const [freeNote, setFreeNote] = useState('');
  const [form, setForm] = useState({
    date: todayStr(), subject: SUBJECTS[0], difficulty: 'medium',
    durationMin: '', total: '', correct: '', note: '',
  });
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [cForm, setCForm] = useState({
    date: todayStr(), type: 'speaking', topic: '', durationMin: '', rating: 3, notes: '',
  });
  const [cFormError, setCFormError] = useState('');
  const [editingCId, setEditingCId] = useState(null);

  const gmatFormRef = useRef(null);
  const consultingFormRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (Array.isArray(data.practiceSets)) setPracticeSets(data.practiceSets);
          if (Array.isArray(data.freeStudySessions)) setFreeStudySessions(data.freeStudySessions);
          if (typeof data.examDate === 'string') setExamDate(data.examDate);
          if (Array.isArray(data.topics)) setTopics(data.topics);
          if (Array.isArray(data.consultingSessions)) setConsultingSessions(data.consultingSessions);
          if (typeof data.interviewDate === 'string') setInterviewDate(data.interviewDate);
        }
      } catch (e) {
        // 没有历史数据，使用默认值
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify({
          practiceSets, freeStudySessions, examDate, topics, consultingSessions, interviewDate,
        }), false);
      } catch (e) {
        console.error('保存失败', e);
      }
    })();
  }, [practiceSets, freeStudySessions, examDate, topics, consultingSessions, interviewDate, loaded]);

  // ---- GMAT 计算 ----
  const practiceMinutes = practiceSets.reduce((a, s) => a + Number(s.durationMin || 0), 0);
  const freeMinutes = freeStudySessions.reduce((a, s) => a + Number(s.durationSec || 0) / 60, 0);
  const gmatTotalMinutes = practiceMinutes + freeMinutes;
  const totalQuestions = practiceSets.reduce((a, s) => a + Number(s.total || 0), 0);
  const totalCorrect = practiceSets.reduce((a, s) => a + Number(s.correct || 0), 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : null;
  const gmatWeekMinutes = (() => {
    let m = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      m += gmatDailyMinutes(practiceSets, freeStudySessions, d.toISOString().slice(0, 10));
    }
    return m;
  })();
  const gmatStreak = computeStreak([
    ...practiceSets.map((s) => ({ date: s.date })),
    ...freeStudySessions.map((s) => ({ date: s.date })),
  ]);
  const daysLeftExam = examDate ? Math.round((new Date(examDate) - new Date(todayStr())) / 86400000) : null;
  const trend = accuracyTrend(practiceSets);
  const bars14 = last14DaysGmat(practiceSets, freeStudySessions);
  const subStats = subjectStats(practiceSets);
  const diffStats = difficultyStats(practiceSets);
  const pacing = pacingBySubject(practiceSets);
  const heat = last70Days(practiceSets, freeStudySessions);
  const maxHeat = Math.max(1, ...heat.map((h) => h.minutes));
  const doneCount = topics.filter((t) => t.done).length;

  // ---- 咨询面试 计算 ----
  const speakingMinutes = consultingSessions.filter((s) => s.type === 'speaking').reduce((a, s) => a + Number(s.durationMin || 0), 0);
  const caseMinutes = consultingSessions.filter((s) => s.type === 'case').reduce((a, s) => a + Number(s.durationMin || 0), 0);
  const consultingTotalMinutes = speakingMinutes + caseMinutes;
  const consultingWeekMinutes = consultingSessions
    .filter((s) => { const diff = (new Date(todayStr()) - new Date(s.date)) / 86400000; return diff >= 0 && diff < 7; })
    .reduce((a, s) => a + Number(s.durationMin || 0), 0);
  const consultingStreak = computeStreak(consultingSessions.map((s) => ({ date: s.date })));
  const daysLeftInterview = interviewDate ? Math.round((new Date(interviewDate) - new Date(todayStr())) / 86400000) : null;
  const speakingTrend = consultingSeries(consultingSessions, 'speaking');
  const caseTrend = consultingSeries(consultingSessions, 'case');

  // ---- 总览 计算 ----
  const grandTotalMinutes = gmatTotalMinutes + consultingTotalMinutes;
  const grandStreak = computeStreak([
    ...practiceSets.map((s) => ({ date: s.date })),
    ...freeStudySessions.map((s) => ({ date: s.date })),
    ...consultingSessions.map((s) => ({ date: s.date })),
  ]);
  const weekSplit = overviewWeekSplit(practiceSets, freeStudySessions, consultingSessions);
  const gmatShare = grandTotalMinutes > 0 ? Math.round((gmatTotalMinutes / grandTotalMinutes) * 100) : 0;

  function handleAddSet(e) {
    if (e && e.preventDefault) e.preventDefault();
    setFormError('');
    const total = Number(form.total);
    const correct = Number(form.correct);
    const durationMin = Number(form.durationMin);
    if (!form.date) return setFormError('请选择日期');
    if (!durationMin || durationMin <= 0) return setFormError('请填写有效的用时（分钟）');
    if (!total || total <= 0) return setFormError('请填写有效的题目总数');
    if (correct < 0 || correct > total) return setFormError('答对题数不能超过总题数');
    setPracticeSets((prev) => [...prev, {
      id: uid(), date: form.date, subject: form.subject, difficulty: form.difficulty,
      durationMin, total, correct, note: form.note.trim(),
      createdAt: Date.now(), deductedFromFree: false,
    }]);
    setForm({ ...form, durationMin: '', total: '', correct: '', note: '' });
  }

  function handleEditSet(s) {
    setEditingId(s.id);
    setFormError('');
    setForm({
      date: s.date, subject: s.subject, difficulty: s.difficulty || 'medium',
      durationMin: String(s.durationMin), total: String(s.total), correct: String(s.correct),
      note: s.note || '',
    });
    if (gmatFormRef.current) gmatFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCancelEditSet() {
    setEditingId(null);
    setFormError('');
    setForm({ date: todayStr(), subject: SUBJECTS[0], difficulty: 'medium', durationMin: '', total: '', correct: '', note: '' });
  }

  function handleSaveEditSet(e) {
    if (e && e.preventDefault) e.preventDefault();
    setFormError('');
    const total = Number(form.total);
    const correct = Number(form.correct);
    const durationMin = Number(form.durationMin);
    if (!form.date) return setFormError('请选择日期');
    if (!durationMin || durationMin <= 0) return setFormError('请填写有效的用时（分钟）');
    if (!total || total <= 0) return setFormError('请填写有效的题目总数');
    if (correct < 0 || correct > total) return setFormError('答对题数不能超过总题数');
    setPracticeSets((prev) => prev.map((s) => (s.id === editingId ? {
      ...s, date: form.date, subject: form.subject, difficulty: form.difficulty,
      durationMin, total, correct, note: form.note.trim(),
    } : s)));
    handleCancelEditSet();
  }

  function handleUseSetTimer(seconds) {
    const minutes = Math.round((seconds / 60) * 10) / 10;
    setForm((f) => ({ ...f, durationMin: String(minutes) }));
  }

  function handleUseFreeTimer(seconds) {
    if (seconds <= 0) return;
    const today = todayStr();
    // 今天已经记录、但还没有被任何一次"整体计时"扣除过的刷题时长，按记录时间先后排队扣除，
    // 避免"整体计时"和"解题计时"里同一段时间被重复计入总学习时长。
    const pending = practiceSets
      .filter((s) => s.date === today && !s.deductedFromFree)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    let budgetSec = seconds;
    const deductIds = [];
    for (const s of pending) {
      const setSec = Math.round(Number(s.durationMin || 0) * 60);
      if (setSec <= budgetSec) {
        budgetSec -= setSec;
        deductIds.push(s.id);
      } else {
        break;
      }
    }
    const netSec = budgetSec;
    const deductedSec = seconds - netSec;

    if (deductIds.length > 0) {
      setPracticeSets((prev) => prev.map((s) => (deductIds.includes(s.id) ? { ...s, deductedFromFree: true } : s)));
    }
    setFreeStudySessions((prev) => [...prev, {
      id: uid(), date: today, durationSec: netSec, rawDurationSec: seconds, deductedSec, note: freeNote.trim(),
    }]);
    setFreeNote('');
  }

  function handleDeleteSet(id) {
    const target = practiceSets.find((s) => s.id === id);
    if (target && target.deductedFromFree) {
      const ok = window.confirm('这条记录的用时已经从某次"整体学习计时"里扣除过了，删除后累计总时长会相应减少。确定要删除吗？');
      if (!ok) return;
    }
    setPracticeSets((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) handleCancelEditSet();
  }

  function handleDeleteFree(id) {
    setFreeStudySessions((prev) => prev.filter((s) => s.id !== id));
  }

  function updateTopic(id, patch) {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function handleAddConsulting(e) {
    if (e && e.preventDefault) e.preventDefault();
    setCFormError('');
    const durationMin = Number(cForm.durationMin);
    if (!cForm.date) return setCFormError('请选择日期');
    if (!durationMin || durationMin <= 0) return setCFormError('请填写有效的练习时长（分钟）');
    if (!cForm.topic.trim()) return setCFormError('请填写练习主题，例如具体的 case 题目或口语话题');
    setConsultingSessions((prev) => [...prev, {
      id: uid(), date: cForm.date, type: cForm.type, topic: cForm.topic.trim(),
      durationMin, rating: cForm.rating, notes: cForm.notes.trim(),
    }]);
    setCForm({ ...cForm, topic: '', durationMin: '', notes: '' });
  }

  function handleEditConsulting(s) {
    setEditingCId(s.id);
    setCFormError('');
    setCForm({
      date: s.date, type: s.type, topic: s.topic, durationMin: String(s.durationMin),
      rating: s.rating, notes: s.notes || '',
    });
    if (consultingFormRef.current) consultingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCancelEditConsulting() {
    setEditingCId(null);
    setCFormError('');
    setCForm({ date: todayStr(), type: 'speaking', topic: '', durationMin: '', rating: 3, notes: '' });
  }

  function handleSaveEditConsulting(e) {
    if (e && e.preventDefault) e.preventDefault();
    setCFormError('');
    const durationMin = Number(cForm.durationMin);
    if (!cForm.date) return setCFormError('请选择日期');
    if (!durationMin || durationMin <= 0) return setCFormError('请填写有效的练习时长（分钟）');
    if (!cForm.topic.trim()) return setCFormError('请填写练习主题，例如具体的 case 题目或口语话题');
    setConsultingSessions((prev) => prev.map((s) => (s.id === editingCId ? {
      ...s, date: cForm.date, type: cForm.type, topic: cForm.topic.trim(),
      durationMin, rating: cForm.rating, notes: cForm.notes.trim(),
    } : s)));
    handleCancelEditConsulting();
  }

  function handleUseConsultingTimer(seconds) {
    const minutes = Math.round((seconds / 60) * 10) / 10;
    setCForm((f) => ({ ...f, durationMin: String(minutes) }));
  }

  function handleDeleteConsulting(id) {
    setConsultingSessions((prev) => prev.filter((s) => s.id !== id));
    if (editingCId === id) handleCancelEditConsulting();
  }

  return (
    <div className="gt-root">
      <style>{`
        .gt-root {
          --bg: #0e1220;
          --panel: #171c2e;
          --panel-2: #1f2540;
          --border: #2a3150;
          --text: #ece8dc;
          --text-dim: #9098b5;
          --amber: #f2a93c;
          --green: #6fcf97;
          --red: #e2685a;
          --teal: #4fb6c0;
          --purple: #9b8cf2;
          background: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
          min-height: 100vh;
          padding: 24px 20px 60px;
          box-sizing: border-box;
        }
        .gt-root * { box-sizing: border-box; }
        .gt-mono { font-family: 'SF Mono', 'Consolas', 'Courier New', monospace; }
        .gt-serif { font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif; }
        .gt-container { max-width: 1040px; margin: 0 auto; }

        .gt-site-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
        .gt-site-title { font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif; font-size: 20px; letter-spacing: 0.4px; }
        .gt-site-title span { color: var(--amber); }
        .gt-tabs { display: flex; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 999px; padding: 4px; }
        .gt-tab-btn {
          border: none; background: transparent; color: var(--text-dim); padding: 8px 16px; border-radius: 999px;
          font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;
        }
        .gt-tab-btn.active { background: var(--amber); color: #1a1305; font-weight: 600; }

        .gt-hero {
          position: relative; overflow: hidden; border-radius: 20px;
          background: linear-gradient(180deg, #141830 0%, #0c0f1c 100%);
          border: 1px solid var(--border); padding: 36px 32px 28px; text-align: center;
        }
        .gt-glow {
          position: absolute; top: -140px; left: 50%; transform: translateX(-50%);
          width: 480px; height: 320px;
          background: radial-gradient(closest-side, rgba(242,169,60,0.35), rgba(242,169,60,0.06) 60%, transparent 80%);
          pointer-events: none;
        }
        .gt-hero.consulting .gt-glow { background: radial-gradient(closest-side, rgba(155,140,242,0.32), rgba(155,140,242,0.05) 60%, transparent 80%); }
        .gt-hero-content { position: relative; z-index: 1; }
        .gt-eyebrow { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: var(--amber); margin-bottom: 10px; }
        .gt-hero.consulting .gt-eyebrow { color: var(--purple); }
        .gt-countdown { font-size: 56px; font-weight: 700; line-height: 1; margin: 4px 0; }
        .gt-countdown-unit { font-size: 20px; color: var(--text-dim); margin-left: 8px; }
        .gt-sub { color: var(--text-dim); font-size: 14px; margin-top: 6px; }
        .gt-date-row { margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .gt-date-row label { font-size: 13px; color: var(--text-dim); }
        .gt-input, .gt-select {
          background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
          padding: 8px 10px; border-radius: 8px; font-size: 14px;
        }
        .gt-input:focus, .gt-select:focus { outline: 2px solid var(--amber); outline-offset: 1px; }

        .gt-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 20px; }
        @media (max-width: 720px) { .gt-stats-row { grid-template-columns: repeat(2, 1fr); } }
        .gt-stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; }
        .gt-stat-icon { color: var(--amber); margin-bottom: 8px; }
        .gt-stat-value { font-size: 21px; font-weight: 700; }
        .gt-stat-label { font-size: 12px; color: var(--text-dim); margin-top: 2px; }

        .gt-section { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-top: 22px; }
        .gt-section-title {
          font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif; font-size: 18px; letter-spacing: 0.4px;
          margin: 0 0 16px; display: flex; align-items: center; gap: 8px;
        }
        .gt-section-title span.n { color: var(--amber); font-family: 'SF Mono', monospace; font-size: 14px; }

        .gt-timer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 720px) { .gt-timer-row { grid-template-columns: 1fr; } }
        .gt-timer-card { border: 1px solid; border-radius: 14px; padding: 18px; background: var(--panel-2); text-align: center; }
        .gt-timer-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .gt-timer-display { font-size: 40px; font-weight: 700; letter-spacing: 1px; }
        .gt-timer-controls { display: flex; justify-content: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
        .gt-btn-sm {
          border: 1px solid var(--border); background: var(--panel); color: var(--text);
          padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
        }
        .gt-btn-sm.gt-btn-ghost { color: var(--text-dim); }
        .gt-btn-sm.gt-btn-primary { color: #1a1305; border: none; font-weight: 600; }
        .gt-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
        .gt-note-input { margin-top: 10px; width: 100%; }

        .gt-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr; gap: 12px; align-items: end; }
        @media (max-width: 900px) { .gt-form-grid { grid-template-columns: repeat(2, 1fr); } }
        .gt-field { display: flex; flex-direction: column; gap: 6px; }
        .gt-field label { font-size: 12px; color: var(--text-dim); }
        .gt-btn {
          background: var(--amber); color: #1a1305; border: none; border-radius: 8px; padding: 10px 16px;
          font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
        }
        .gt-btn:hover { filter: brightness(1.06); }
        .gt-error { color: var(--red); font-size: 13px; margin-top: 10px; }

        .gt-chart-wrap { width: 100%; height: 220px; margin-top: 8px; }
        .gt-chart-wrap.sm { height: 180px; }
        .gt-charts-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 800px) { .gt-charts-2col { grid-template-columns: 1fr; } }

        .gt-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
        .gt-table th { text-align: left; color: var(--text-dim); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .gt-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); }
        .gt-table tr:hover td { background: rgba(255,255,255,0.02); }
        .gt-badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; white-space: nowrap; }
        .gt-empty { color: var(--text-dim); font-size: 14px; padding: 20px 0; text-align: center; }

        .gt-heat-grid { display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 4px; margin-top: 10px; }
        .gt-heat-cell { width: 100%; aspect-ratio: 1; border-radius: 3px; background: var(--panel-2); border: 1px solid var(--border); }

        .gt-topic-progress-bar { height: 6px; border-radius: 999px; background: var(--panel-2); overflow: hidden; margin-bottom: 16px; }
        .gt-topic-progress-fill { height: 100%; background: var(--amber); }
        .gt-topic-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 10px; flex-wrap: wrap; }
        .gt-topic-item:last-child { border-bottom: none; }
        .gt-topic-name { font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .gt-topic-cat { font-size: 11px; color: var(--text-dim); background: var(--panel-2); padding: 2px 8px; border-radius: 999px; }
        .gt-dots { display: flex; gap: 4px; }
        .gt-dot { border-radius: 50%; border: 1px solid var(--border); background: var(--panel-2); cursor: pointer; }
        .gt-dot.active { background: var(--amber); border-color: var(--amber); }
        .gt-checkbox { width: 16px; height: 16px; accent-color: var(--amber); cursor: pointer; }

        .gt-pace-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 800px) { .gt-pace-grid { grid-template-columns: 1fr; } }
        .gt-pace-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .gt-pace-subject { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .gt-pace-nums { font-size: 12px; color: var(--text-dim); margin-bottom: 8px; }
        .gt-pace-bar-track { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; position: relative; }
        .gt-pace-bar-fill { height: 100%; border-radius: 999px; }
        .gt-pace-verdict { font-size: 13px; font-weight: 600; margin-top: 8px; }

        .gt-split-bar { display: flex; height: 22px; border-radius: 999px; overflow: hidden; margin-top: 10px; }
        .gt-split-seg-a { background: var(--amber); }
        .gt-split-seg-b { background: var(--purple); }
        .gt-split-legend { display: flex; gap: 18px; margin-top: 10px; font-size: 12px; color: var(--text-dim); }
        .gt-legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
      `}</style>

      <div className="gt-container">
        <div className="gt-site-header">
          <div className="gt-site-title">我的<span>备考</span>基地</div>
          <div className="gt-tabs">
            <button className={`gt-tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
              <LayoutDashboard size={14} /> 总览
            </button>
            <button className={`gt-tab-btn ${tab === 'gmat' ? 'active' : ''}`} onClick={() => setTab('gmat')}>
              <BookOpenCheck size={14} /> GMAT
            </button>
            <button className={`gt-tab-btn ${tab === 'consulting' ? 'active' : ''}`} onClick={() => setTab('consulting')}>
              <Briefcase size={14} /> 咨询面试
            </button>
          </div>
        </div>

        {tab === 'overview' && (
          <>
            <div className="gt-hero">
              <div className="gt-glow" />
              <div className="gt-hero-content">
                <div className="gt-eyebrow">全部投入</div>
                <div className="gt-serif gt-countdown gt-mono">
                  {fmtMinutes(grandTotalMinutes)}
                </div>
                <div className="gt-sub">
                  GMAT {fmtMinutes(gmatTotalMinutes)} · 咨询面试 {fmtMinutes(consultingTotalMinutes)}
                </div>
              </div>
            </div>

            <div className="gt-stats-row">
              <div className="gt-stat-card">
                <Clock3 size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(grandTotalMinutes)}</div>
                <div className="gt-stat-label">累计总学习时长</div>
              </div>
              <div className="gt-stat-card">
                <Flame size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{grandStreak} 天</div>
                <div className="gt-stat-label">连续打卡（任一模块）</div>
              </div>
              <div className="gt-stat-card">
                <Target size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{daysLeftExam !== null ? `${daysLeftExam} 天` : '未设置'}</div>
                <div className="gt-stat-label">距离 GMAT 考试</div>
              </div>
              <div className="gt-stat-card">
                <Briefcase size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{daysLeftInterview !== null ? `${daysLeftInterview} 天` : '未设置'}</div>
                <div className="gt-stat-label">距离面试</div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">01</span> 时间投入占比</h3>
              {grandTotalMinutes === 0 ? (
                <div className="gt-empty">还没有任何记录，去 GMAT 或咨询面试标签页添加第一条吧</div>
              ) : (
                <>
                  <div className="gt-split-bar">
                    <div className="gt-split-seg-a" style={{ width: `${gmatShare}%` }} />
                    <div className="gt-split-seg-b" style={{ width: `${100 - gmatShare}%` }} />
                  </div>
                  <div className="gt-split-legend">
                    <span><span className="gt-legend-dot" style={{ background: 'var(--amber)' }} />GMAT {gmatShare}%</span>
                    <span><span className="gt-legend-dot" style={{ background: 'var(--purple)' }} />咨询面试 {100 - gmatShare}%</span>
                  </div>
                </>
              )}
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">02</span> 近14天时间分配</h3>
              <div className="gt-chart-wrap">
                <ResponsiveContainer>
                  <BarChart data={weekSplit} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                    <XAxis dataKey="date" tick={{ fill: '#9098b5', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9098b5', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#9098b5' }} />
                    <Bar dataKey="GMAT" stackId="a" fill="#f2a93c" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="咨询面试" stackId="a" fill="#9b8cf2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === 'gmat' && (
          <>
            <div className="gt-hero">
              <div className="gt-glow" />
              <div className="gt-hero-content">
                <div className="gt-eyebrow">GMAT 夜间自习室</div>
                {daysLeftExam !== null ? (
                  <div className="gt-serif gt-countdown">
                    {daysLeftExam >= 0 ? daysLeftExam : 0}
                    <span className="gt-countdown-unit">{daysLeftExam >= 0 ? '天后考试' : '天前已考试'}</span>
                  </div>
                ) : (
                  <div className="gt-serif" style={{ fontSize: 22, color: 'var(--text-dim)' }}>设置考试日期，开始倒计时</div>
                )}
                <div className="gt-sub">每一晚的灯光，都是离目标更近的一步</div>
                <div className="gt-date-row">
                  <label htmlFor="examDate">考试日期</label>
                  <input id="examDate" type="date" className="gt-input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="gt-stats-row">
              <div className="gt-stat-card">
                <Clock3 size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(gmatTotalMinutes)}</div>
                <div className="gt-stat-label">累计学习时长</div>
              </div>
              <div className="gt-stat-card">
                <Clock3 size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(gmatWeekMinutes)}</div>
                <div className="gt-stat-label">本周学习时长</div>
              </div>
              <div className="gt-stat-card">
                <Target size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{overallAccuracy !== null ? `${overallAccuracy}%` : '—'}</div>
                <div className="gt-stat-label">总体正确率（{totalCorrect}/{totalQuestions}）</div>
              </div>
              <div className="gt-stat-card">
                <Flame size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{gmatStreak} 天</div>
                <div className="gt-stat-label">连续打卡</div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">01</span> 计时器</h3>
              <div className="gt-timer-row">
                <Stopwatch
                  label="整体学习计时"
                  accent="var(--teal)"
                  useLabel="结束并保存"
                  onUse={handleUseFreeTimer}
                  extra={
                    <input
                      type="text"
                      className="gt-input gt-note-input"
                      placeholder="备注（可选，例如：复习错题）"
                      value={freeNote}
                      onChange={(e) => setFreeNote(e.target.value)}
                    />
                  }
                />
                <Stopwatch
                  label="解题计时（当前这一套）"
                  accent="var(--amber)"
                  useLabel="停止并填入用时"
                  onUse={handleUseSetTimer}
                />
              </div>
            </div>

            <div className="gt-section" ref={gmatFormRef} style={editingId ? { borderColor: 'var(--amber)', boxShadow: '0 0 0 1px var(--amber)' } : undefined}>
              <h3 className="gt-section-title"><span className="n">02</span> {editingId ? '编辑刷题记录' : '记录一次刷题'}</h3>
              <div className="gt-form-grid">
                <div className="gt-field">
                  <label>日期</label>
                  <input type="date" className="gt-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="gt-field">
                  <label>科目</label>
                  <select className="gt-select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="gt-field">
                  <label>难度</label>
                  <select className="gt-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
                  </select>
                </div>
                <div className="gt-field">
                  <label>用时（分钟）</label>
                  <input type="number" min="0" step="0.1" className="gt-input" value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="可由计时器自动填入" />
                </div>
                <div className="gt-field">
                  <label>总题数</label>
                  <input type="number" min="0" className="gt-input" value={form.total}
                    onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="例如 20" />
                </div>
                <div className="gt-field">
                  <label>答对题数</label>
                  <input type="number" min="0" className="gt-input" value={form.correct}
                    onChange={(e) => setForm({ ...form, correct: e.target.value })} placeholder="例如 16" />
                </div>
                <div className="gt-field" style={{ gridColumn: '1 / -1' }}>
                  <label>备注（可选）</label>
                  <input type="text" className="gt-input" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="例如：这套题几何题错得多" />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {editingId ? (
                    <>
                      <button type="button" className="gt-btn" onClick={handleSaveEditSet}><Pencil size={16} /> 保存修改</button>
                      <button type="button" className="gt-btn-sm gt-btn-ghost" onClick={handleCancelEditSet}><X size={13} /> 取消编辑</button>
                    </>
                  ) : (
                    <button type="button" className="gt-btn" onClick={handleAddSet}><Plus size={16} /> 添加记录</button>
                  )}
                  {formError && <div className="gt-error">{formError}</div>}
                </div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">03</span> 正确率趋势</h3>
              {trend.length === 0 ? (
                <div className="gt-empty">还没有记录，添加第一次刷题后这里会出现趋势图</div>
              ) : (
                <div className="gt-chart-wrap">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                      <XAxis dataKey="name" tick={{ fill: '#9098b5', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: '#9098b5', fontSize: 11 }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                      <Line type="monotone" dataKey="accuracy" stroke="#f2a93c" strokeWidth={2} dot={{ r: 3 }} name="正确率" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">04</span> 近14天学习时长（分钟）</h3>
              <div className="gt-chart-wrap">
                <ResponsiveContainer>
                  <BarChart data={bars14} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                    <XAxis dataKey="date" tick={{ fill: '#9098b5', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9098b5', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                    <Bar dataKey="minutes" fill="#4fb6c0" radius={[4, 4, 0, 0]} name="分钟" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {subStats.length > 0 && (
              <div className="gt-section">
                <h3 className="gt-section-title"><span className="n">05</span> 各科目正确率对比</h3>
                <div className="gt-chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={subStats} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                      <XAxis dataKey="subject" tick={{ fill: '#9098b5', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#9098b5', fontSize: 11 }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="正确率">
                        {subStats.map((s, i) => <Cell key={i} fill={SUBJECT_COLORS[s.subject] || '#9098b5'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">06</span> 配速分析（对比官方标准）</h3>
              {pacing.length === 0 ? (
                <div className="gt-empty">记录 Quant / Verbal / Data Insights 的刷题后，这里会显示你的配速与官方标准的对比</div>
              ) : (
                <div className="gt-pace-grid">
                  {pacing.map((p) => {
                    const faster = p.deltaSec < 0;
                    const ratio = Math.min(1.6, p.yourPaceSec / p.stdPaceSec);
                    return (
                      <div className="gt-pace-card" key={p.subject}>
                        <div className="gt-pace-subject">{p.subject}</div>
                        <div className="gt-pace-nums">
                          你的配速 {p.yourPaceSec}秒/题 · 标准 {p.stdPaceSec}秒/题
                        </div>
                        <div className="gt-pace-bar-track">
                          <div
                            className="gt-pace-bar-fill"
                            style={{ width: `${Math.min(100, ratio * 62.5)}%`, background: faster ? 'var(--green)' : 'var(--red)' }}
                          />
                        </div>
                        <div className="gt-pace-verdict" style={{ color: faster ? 'var(--green)' : 'var(--red)' }}>
                          {faster ? `快于标准 ${Math.abs(p.deltaSec)} 秒/题` : `慢于标准 ${p.deltaSec} 秒/题`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="gt-sub" style={{ marginTop: 14, textAlign: 'left' }}>
                官方标准：Quant 21题/45分钟 · Verbal 23题/45分钟 · Data Insights 20题/45分钟
              </div>
            </div>

            {diffStats.length > 0 && (
              <div className="gt-section">
                <h3 className="gt-section-title"><span className="n">07</span> 不同难度正确率</h3>
                <div className="gt-chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={diffStats} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                      <XAxis dataKey="difficulty" tick={{ fill: '#9098b5', fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#9098b5', fontSize: 11 }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="正确率">
                        {diffStats.map((d, i) => <Cell key={i} fill={DIFFICULTY_COLOR[d.key]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">08</span> 打卡日历（近70天）</h3>
              <div className="gt-heat-grid">
                {heat.map((h) => {
                  const intensity = h.minutes / maxHeat;
                  const bg = h.minutes === 0 ? 'var(--panel-2)' : `rgba(242,169,60,${0.15 + intensity * 0.75})`;
                  return <div key={h.date} className="gt-heat-cell" style={{ background: bg }} title={`${h.date} · ${h.minutes} 分钟`} />;
                })}
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><BookOpenCheck size={18} color="var(--amber)" /> 知识点掌握进度（{doneCount}/{topics.length}）</h3>
              <div className="gt-topic-progress-bar">
                <div className="gt-topic-progress-fill" style={{ width: `${topics.length ? (doneCount / topics.length) * 100 : 0}%` }} />
              </div>
              {topics.map((t) => (
                <div className="gt-topic-item" key={t.id}>
                  <div className="gt-topic-name">
                    <input type="checkbox" className="gt-checkbox" checked={t.done} onChange={(e) => updateTopic(t.id, { done: e.target.checked })} />
                    <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-dim)' : 'var(--text)' }}>{t.name}</span>
                    <span className="gt-topic-cat">{t.category}</span>
                  </div>
                  <Dots value={t.mastery} onChange={(v) => updateTopic(t.id, { mastery: v })} />
                </div>
              ))}
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">09</span> 历史记录</h3>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>刷题记录（{practiceSets.length}）</div>
              {practiceSets.length === 0 ? (
                <div className="gt-empty">暂无刷题记录</div>
              ) : (
                <table className="gt-table">
                  <thead>
                    <tr>
                      <th>日期</th><th>科目</th><th>难度</th><th>用时</th><th>题数</th><th>正确率</th><th>配速</th><th>备注</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...practiceSets].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => {
                      const acc = s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0;
                      const bench = BENCHMARK[s.subject];
                      let paceLabel = '—';
                      let paceColor = 'var(--text-dim)';
                      if (bench && s.total > 0) {
                        const yourPaceSec = Math.round((s.durationMin / s.total) * 60);
                        const stdPaceSec = Math.round((bench.m / bench.q) * 60);
                        const delta = yourPaceSec - stdPaceSec;
                        paceLabel = delta <= 0 ? `快 ${Math.abs(delta)}s/题` : `慢 ${delta}s/题`;
                        paceColor = delta <= 0 ? 'var(--green)' : 'var(--red)';
                      }
                      return (
                        <tr key={s.id}>
                          <td className="gt-mono">{s.date}</td>
                          <td><span className="gt-badge" style={{ background: `${SUBJECT_COLORS[s.subject] || '#9098b5'}22`, color: SUBJECT_COLORS[s.subject] || '#9098b5' }}>{s.subject}</span></td>
                          <td><span className="gt-badge" style={{ background: `${DIFFICULTY_COLOR[s.difficulty || 'medium']}22`, color: DIFFICULTY_COLOR[s.difficulty || 'medium'] }}>{DIFFICULTY_LABEL[s.difficulty || 'medium']}</span></td>
                          <td className="gt-mono">{s.durationMin} 分钟</td>
                          <td className="gt-mono">{s.correct}/{s.total}</td>
                          <td className="gt-mono" style={{ color: acc >= 70 ? 'var(--green)' : acc >= 50 ? 'var(--amber)' : 'var(--red)' }}>{acc}%</td>
                          <td className="gt-mono" style={{ color: paceColor, fontSize: 12 }}>{paceLabel}</td>
                          <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                            {s.note}
                            {s.deductedFromFree && (
                              <span className="gt-badge" style={{ marginLeft: 6, background: 'rgba(79,182,192,0.15)', color: 'var(--teal)' }} title="这条记录的用时已从某次整体学习计时中扣除，避免重复计入总时长">已计入整体</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEditSet(s)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', marginRight: 6 }} title="编辑"><Pencil size={15} /></button>
                            <button onClick={() => handleDeleteSet(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} title="删除"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div style={{ fontSize: 13, color: 'var(--text-dim)', margin: '20px 0 6px' }}>
                整体学习计时记录（{freeStudySessions.length}）
                <span style={{ fontSize: 12, marginLeft: 8 }}>· 为避免与"解题计时"重复计算，系统会自动从整体计时里扣掉当天已单独记录且尚未扣除的刷题时长</span>
              </div>
              {freeStudySessions.length === 0 ? (
                <div className="gt-empty">暂无整体学习计时记录</div>
              ) : (
                <table className="gt-table">
                  <thead><tr><th>日期</th><th>计时器耗时</th><th>已扣除重叠</th><th>记为总时长</th><th>备注</th><th></th></tr></thead>
                  <tbody>
                    {[...freeStudySessions].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
                      <tr key={s.id}>
                        <td className="gt-mono">{s.date}</td>
                        <td className="gt-mono">{fmtClock(s.rawDurationSec != null ? s.rawDurationSec : s.durationSec)}</td>
                        <td className="gt-mono" style={{ color: (s.deductedSec || 0) > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>
                          {(s.deductedSec || 0) > 0 ? `− ${fmtClock(s.deductedSec)}` : '—'}
                        </td>
                        <td className="gt-mono" style={{ color: 'var(--green)' }}>{fmtClock(s.durationSec)}</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.note}</td>
                        <td><button onClick={() => handleDeleteFree(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} title="删除"><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'consulting' && (
          <>
            <div className="gt-hero consulting">
              <div className="gt-glow" />
              <div className="gt-hero-content">
                <div className="gt-eyebrow">咨询面试备考</div>
                {daysLeftInterview !== null ? (
                  <div className="gt-serif gt-countdown">
                    {daysLeftInterview >= 0 ? daysLeftInterview : 0}
                    <span className="gt-countdown-unit">{daysLeftInterview >= 0 ? '天后面试' : '天前已面试'}</span>
                  </div>
                ) : (
                  <div className="gt-serif" style={{ fontSize: 22, color: 'var(--text-dim)' }}>设置面试日期，开始倒计时</div>
                )}
                <div className="gt-sub">英文口语 + Case 拆解，每天进步一点</div>
                <div className="gt-date-row">
                  <label htmlFor="interviewDate">面试日期</label>
                  <input id="interviewDate" type="date" className="gt-input" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="gt-stats-row">
              <div className="gt-stat-card">
                <Clock3 size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(consultingTotalMinutes)}</div>
                <div className="gt-stat-label">累计练习时长</div>
              </div>
              <div className="gt-stat-card">
                <Clock3 size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(consultingWeekMinutes)}</div>
                <div className="gt-stat-label">本周练习时长</div>
              </div>
              <div className="gt-stat-card">
                <Mic size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(speakingMinutes)}</div>
                <div className="gt-stat-label">口语练习时长</div>
              </div>
              <div className="gt-stat-card">
                <Briefcase size={18} className="gt-stat-icon" />
                <div className="gt-stat-value gt-mono">{fmtMinutes(caseMinutes)}</div>
                <div className="gt-stat-label">Case 练习时长</div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">01</span> 计时器</h3>
              <div className="gt-timer-row" style={{ gridTemplateColumns: '1fr' }}>
                <Stopwatch label="练习计时" accent="var(--purple)" useLabel="停止并填入用时" onUse={handleUseConsultingTimer} />
              </div>
            </div>

            <div className="gt-section" ref={consultingFormRef} style={editingCId ? { borderColor: 'var(--purple)', boxShadow: '0 0 0 1px var(--purple)' } : undefined}>
              <h3 className="gt-section-title"><span className="n">02</span> {editingCId ? '编辑练习记录' : '记录一次练习'}</h3>
              <div className="gt-form-grid">
                <div className="gt-field">
                  <label>日期</label>
                  <input type="date" className="gt-input" value={cForm.date} onChange={(e) => setCForm({ ...cForm, date: e.target.value })} />
                </div>
                <div className="gt-field">
                  <label>类型</label>
                  <select className="gt-select" value={cForm.type} onChange={(e) => setCForm({ ...cForm, type: e.target.value })}>
                    <option value="speaking">英文口语练习</option>
                    <option value="case">Case 案例分析</option>
                  </select>
                </div>
                <div className="gt-field" style={{ gridColumn: 'span 2' }}>
                  <label>主题</label>
                  <input type="text" className="gt-input" value={cForm.topic}
                    onChange={(e) => setCForm({ ...cForm, topic: e.target.value })}
                    placeholder={cForm.type === 'case' ? '例如：某咖啡品牌市场进入 case' : '例如：自我介绍 + 追问练习'} />
                </div>
                <div className="gt-field">
                  <label>时长（分钟）</label>
                  <input type="number" min="0" step="0.1" className="gt-input" value={cForm.durationMin}
                    onChange={(e) => setCForm({ ...cForm, durationMin: e.target.value })} placeholder="可由计时器自动填入" />
                </div>
                <div className="gt-field">
                  <label>自我评分</label>
                  <Dots value={cForm.rating} onChange={(v) => setCForm({ ...cForm, rating: v })} size={18} />
                </div>
                <div className="gt-field" style={{ gridColumn: '1 / -1' }}>
                  <label>备注（可选）</label>
                  <input type="text" className="gt-input" value={cForm.notes}
                    onChange={(e) => setCForm({ ...cForm, notes: e.target.value })}
                    placeholder="例如：框架搭得快，但计算部分卡壳 / 发音需要加强" />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {editingCId ? (
                    <>
                      <button type="button" className="gt-btn" onClick={handleSaveEditConsulting}><Pencil size={16} /> 保存修改</button>
                      <button type="button" className="gt-btn-sm gt-btn-ghost" onClick={handleCancelEditConsulting}><X size={13} /> 取消编辑</button>
                    </>
                  ) : (
                    <button type="button" className="gt-btn" onClick={handleAddConsulting}><Plus size={16} /> 添加记录</button>
                  )}
                  {cFormError && <div className="gt-error">{cFormError}</div>}
                </div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">03</span> 自我评分趋势</h3>
              <div className="gt-charts-2col">
                <div>
                  <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 4 }}>英文口语</div>
                  {speakingTrend.length === 0 ? (
                    <div className="gt-empty">暂无口语练习记录</div>
                  ) : (
                    <div className="gt-chart-wrap sm">
                      <ResponsiveContainer>
                        <LineChart data={speakingTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                          <XAxis dataKey="name" tick={{ fill: '#9098b5', fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis domain={[0, 5]} tick={{ fill: '#9098b5', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                          <Line type="monotone" dataKey="rating" stroke="#4fb6c0" strokeWidth={2} dot={{ r: 3 }} name="评分" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--purple)', marginBottom: 4 }}>Case 案例分析</div>
                  {caseTrend.length === 0 ? (
                    <div className="gt-empty">暂无 Case 练习记录</div>
                  ) : (
                    <div className="gt-chart-wrap sm">
                      <ResponsiveContainer>
                        <LineChart data={caseTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                          <XAxis dataKey="name" tick={{ fill: '#9098b5', fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis domain={[0, 5]} tick={{ fill: '#9098b5', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1f2540', border: '1px solid #2a3150', color: '#ece8dc' }} />
                          <Line type="monotone" dataKey="rating" stroke="#9b8cf2" strokeWidth={2} dot={{ r: 3 }} name="评分" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="gt-section">
              <h3 className="gt-section-title"><span className="n">04</span> 历史记录（{consultingSessions.length}）</h3>
              {consultingSessions.length === 0 ? (
                <div className="gt-empty">暂无记录</div>
              ) : (
                <table className="gt-table">
                  <thead><tr><th>日期</th><th>类型</th><th>主题</th><th>时长</th><th>评分</th><th>备注</th><th></th></tr></thead>
                  <tbody>
                    {[...consultingSessions].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
                      <tr key={s.id}>
                        <td className="gt-mono">{s.date}</td>
                        <td><span className="gt-badge" style={{ background: `${CONSULTING_TYPE_COLOR[s.type]}22`, color: CONSULTING_TYPE_COLOR[s.type] }}>{CONSULTING_TYPE_LABEL[s.type]}</span></td>
                        <td style={{ fontSize: 13 }}>{s.topic}</td>
                        <td className="gt-mono">{s.durationMin} 分钟</td>
                        <td className="gt-mono">{s.rating}/5</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.notes}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleEditConsulting(s)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', marginRight: 6 }} title="编辑"><Pencil size={15} /></button>
                          <button onClick={() => handleDeleteConsulting(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} title="删除"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
