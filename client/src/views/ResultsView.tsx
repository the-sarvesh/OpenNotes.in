import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { attemptLabel, examGroup, sumScores, type CourseMarks, type ExamScore } from '../utils/resultMarks';

interface MarksResponse {
  rollNumber: string;
  name: string | null;
  rows: CourseMarks[];
}

const firstLookJokes = [
  'Borrowing a supercomputer to fetch your marks…',
  'Do you really think you’re gonna pass? 😅',
  'Supercomputer says: “I fetch marks, not miracles.”',
  'Checking whether your confidence survived the exam…',
  'Practising a surprised face, just in case. 😮',
];
const repeatJokes = [
  'Back already? The marks missed you too. 👀',
  'Checking twice does not add grace marks. We asked. 😅',
  'The supercomputer remembers this account.',
  'Maybe they changed? The suspense says probably not.',
  'Deep breath. Same exam, fresh courage. 🫡',
];
const pollReplies: Record<string, string> = {
  ready: 'Love the energy. The supercomputer is taking notes. ✍️',
  maybe: 'A classic “depends on the marking scheme” answer. 🤝',
  nope: 'Fair. Let’s ask the marks instead. 🫣',
};

const scoreText = (score: ExamScore) => `${score.earned} / ${score.maximum}`;

function ScoreCell({ matches }: { matches: ExamScore[] }) {
  if (matches.length === 0) return <span className="text-slate-500">—</span>;
  if (matches.length === 1) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <strong className="font-bold text-white tabular-nums">{scoreText(matches[0])}</strong>
        {attemptLabel(matches[0].type) !== matches[0].type && (
          <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {attemptLabel(matches[0].type)}
          </span>
        )}
      </span>
    );
  }
  return (
    <div className="space-y-1.5">
      {matches.map((exam, index) => (
        <div key={`${exam.type}-${exam.examDate}-${index}`} className="text-xs leading-5 text-slate-200">
          <span className="font-bold text-white">{attemptLabel(exam.type)}:</span> {scoreText(exam)}
          {exam.examDate && <span className="text-slate-400"> · {exam.examDate}</span>}
        </div>
      ))}
    </div>
  );
}

function SemesterResults({ semester, courses }: { semester: string; courses: CourseMarks[] }) {
  const examTypes = [...new Set(courses.flatMap((course) => course.exams.map((exam) => examGroup(exam.type))))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const matchesFor = (course: CourseMarks, type: string) =>
    course.exams.filter((exam) => examGroup(exam.type) === type);
  const courseTotal = (course: CourseMarks) => {
    const matches = examTypes.map((type) => matchesFor(course, type));
    return matches.every((group) => group.length === 1) ? sumScores(matches.map((group) => group[0])) : null;
  };
  const columnTotal = (type: string) => {
    const matches = courses.map((course) => matchesFor(course, type));
    return matches.every((group) => group.length === 1) ? sumScores(matches.map((group) => group[0])) : null;
  };
  const allScores = courses.flatMap((course) => examTypes.flatMap((type) => matchesFor(course, type)));
  const semesterTotal = courses.every((course) => courseTotal(course) !== null) ? sumScores(allScores) : null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-white/15 bg-white/[0.07] shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
        <h2 className="text-xl font-black tracking-tight text-white">{semester}</h2>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">
          {examTypes.join(' · ')}
        </span>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-white/[0.06] text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-6 py-4">Course</th>
              {examTypes.map((type) => <th key={type} className="px-5 py-4">{type}</th>)}
              <th className="px-5 py-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, index) => {
              const total = courseTotal(course);
              return (
                <tr key={`${course.course}-${index}`} className="border-t border-white/10">
                  <th scope="row" className="px-6 py-5 text-sm font-semibold text-white">{course.course}</th>
                  {examTypes.map((type) => (
                    <td key={type} className="px-5 py-5"><ScoreCell matches={matchesFor(course, type)} /></td>
                  ))}
                  <td className="px-5 py-5 font-bold text-amber-200 tabular-nums">
                    {total ? `${total.earned} / ${total.maximum}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-amber-300/20 bg-amber-300/[0.07] text-sm font-bold text-amber-100">
            <tr>
              <th scope="row" className="px-6 py-5">Semester total</th>
              {examTypes.map((type) => {
                const total = columnTotal(type);
                return <td key={type} className="px-5 py-5 tabular-nums">{total ? `${total.earned} / ${total.maximum}` : '—'}</td>;
              })}
              <td className="px-5 py-5 tabular-nums">{semesterTotal ? `${semesterTotal.earned} / ${semesterTotal.maximum}` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {courses.map((course, index) => {
          const total = courseTotal(course);
          return (
            <div key={`${course.course}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <h3 className="mb-4 text-sm font-bold text-white">{course.course}</h3>
              <div className="grid grid-cols-2 gap-2">
                {examTypes.map((type) => (
                  <div key={type} className="rounded-xl bg-white/[0.06] p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{type}</div>
                    <ScoreCell matches={matchesFor(course, type)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm font-bold">
                <span className="text-slate-300">Total</span>
                <span className="text-amber-200 tabular-nums">{total ? `${total.earned} / ${total.maximum}` : '—'}</span>
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
          <div className="mb-3 font-bold text-amber-100">Semester total</div>
          <div className="grid grid-cols-2 gap-2">
            {examTypes.map((type) => {
              const total = columnTotal(type);
              return (
                <div key={type} className="text-xs text-slate-300">
                  <span className="mr-2 font-bold">{type}</span>
                  <span className="tabular-nums">{total ? `${total.earned} / ${total.maximum}` : '—'}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-amber-300/20 pt-3 text-sm font-black text-amber-100 tabular-nums">
            Total: {semesterTotal ? `${semesterTotal.earned} / ${semesterTotal.maximum}` : '—'}
          </div>
        </div>
      </div>
    </section>
  );
}

export const ResultsView: React.FC = () => {
  const { user } = useAuth();
  const rollNumber = user?.email.match(/^([a-z0-9]{11})@wilp\.bits-pilani\.ac\.in$/i)?.[1].toUpperCase() || null;
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'results' | 'error'>('idle');
  const [data, setData] = useState<MarksResponse | null>(null);
  const [error, setError] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [confidence, setConfidence] = useState('');
  const [repeatCount, setRepeatCount] = useState(0);
  const [skipPending, setSkipPending] = useState(false);
  const pending = useRef<MarksResponse | null>(null);
  const elapsed = useRef(false);
  const skip = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    controller.current?.abort();
  }, []);

  const semesters = useMemo(() => {
    const groups = new Map<string, CourseMarks[]>();
    for (const course of data?.rows || []) {
      if (!groups.has(course.semester)) groups.set(course.semester, []);
      groups.get(course.semester)!.push(course);
    }
    return groups;
  }, [data]);

  const reveal = (result: MarksResponse) => {
    timers.current.forEach(clearTimeout);
    setData(result);
    setPhase('results');
  };

  const checkResults = async () => {
    if (!user || !rollNumber || phase === 'loading' || phase === 'ready') return;
    const storageKey = `opennotes-results-checks:${user.id}`;
    let previous = 0;
    try { previous = Number(sessionStorage.getItem(storageKey) || 0) || 0; } catch { /* No storage available. */ }
    setRepeatCount(previous);
    setMessageIndex(0);
    setConfidence('');
    setSkipPending(false);
    setError('');
    setData(null);
    setPhase('loading');
    pending.current = null;
    elapsed.current = false;
    skip.current = false;
    timers.current.forEach(clearTimeout);
    controller.current?.abort();
    controller.current = new AbortController();
    const jokeTimer = setInterval(() => setMessageIndex((index) => Math.min(index + 1, 4)), 1500);
    timers.current.push(jokeTimer);
    timers.current.push(setTimeout(() => {
      elapsed.current = true;
      if (pending.current && !skip.current) {
        clearInterval(jokeTimer);
        setPhase('ready');
      }
    }, 6500));
    try {
      const response = await apiRequest('/api/results/me', { signal: controller.current.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load results.');
      pending.current = result as MarksResponse;
      try { sessionStorage.setItem(storageKey, String(previous + 1)); } catch { /* No storage available. */ }
      if (skip.current) reveal(result);
      else if (elapsed.current) {
        clearInterval(jokeTimer);
        setPhase('ready');
      }
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      timers.current.forEach(clearTimeout);
      setError(cause instanceof Error ? cause.message : 'Could not load results. Please try again.');
      setPhase('error');
    }
  };

  const skipSuspense = () => {
    skip.current = true;
    if (pending.current) reveal(pending.current);
    else setSkipPending(true);
  };

  const jokes = repeatCount > 0 ? repeatJokes : firstLookJokes;
  const isDialogOpen = phase === 'loading' || phase === 'ready';

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#071a34] px-4 py-12 text-white sm:px-6">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-48 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="rounded-[28px] border border-white/20 bg-white/[0.09] p-7 shadow-2xl shadow-slate-950/30 backdrop-blur-2xl sm:p-10">
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
            <Sparkles size={16} /> Your results
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Exam marks</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Your exam scores, one term at a time.</p>
          {rollNumber ? (
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
                <p className="mt-1 text-lg font-bold">{user?.name}</p>
                <p className="text-xs text-slate-400">Roll number {rollNumber}</p>
              </div>
              <button
                type="button"
                onClick={checkResults}
                disabled={isDialogOpen}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-6 text-sm font-black text-[#122b4c] shadow-lg shadow-amber-400/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
              >
                <Eye size={17} /> {phase === 'results' ? 'Check again' : 'Show my marks'}
              </button>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              Sign in with a verified WILP roll-number email to see your results.
            </div>
          )}
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} /> Results are available only to the matching signed-in student.</p>
        </header>

        {phase === 'error' && (
          <p role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</p>
        )}
        {phase === 'results' && data && (
          <div className="space-y-6" aria-live="polite">
            {data.rows.length > 0 ? (
              <>
                <div className="rounded-2xl border border-white/15 bg-white/[0.08] px-6 py-4 backdrop-blur-xl">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Student</p>
                  <p className="mt-1 text-lg font-black">{data.name || user?.name || 'Name unavailable'}</p>
                </div>
                {[...semesters].map(([semester, courses]) => (
                  <div key={semester}><SemesterResults semester={semester} courses={courses} /></div>
                ))}
              </>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-8 text-center text-slate-200">
                No exam marks found for this account yet.
              </div>
            )}
          </div>
        )}
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#061932]/85 p-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="results-loading-title">
          <div className="my-auto w-full max-w-lg rounded-[28px] border border-white/20 bg-[#133761]/95 p-6 text-center shadow-2xl shadow-black/40 sm:p-9">
            <div className={`mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border-[3px] border-amber-300 bg-blue-400/10 text-3xl ${phase === 'loading' ? 'animate-pulse' : ''}`}>
              {phase === 'ready' ? '👀' : '📊'}
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
              {phase === 'ready' ? 'Results ready' : 'Fetching results'}
            </p>
            <h2 id="results-loading-title" aria-live="polite" className="mt-4 min-h-20 text-2xl font-black leading-tight sm:text-3xl">
              {phase === 'ready'
                ? repeatCount > 0 ? 'Yes, they’re still here. Ready to look again? 😏' : 'The suspense has done enough damage. 😌'
                : jokes[messageIndex]}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {phase === 'ready' ? 'Your marks are ready when you are.' :
                skipPending ? 'Skipping the jokes. Fetching your marks…' :
                  repeatCount > 0 ? `Check number ${repeatCount + 1} for this account. No judgement. Much. 😏` :
                    'Even the supercomputer looks nervous.'}
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <p className="mb-3 text-xs font-bold text-slate-200">Quick question: how confident are you?</p>
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="How confident are you?">
                {([
                  ['ready', 'Very 😎'], ['maybe', 'Maybe 😬'], ['nope', 'Next question 🙃'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setConfidence(value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${confidence === value ? 'border-amber-300 bg-amber-300 text-[#102b4d]' : 'border-white/15 bg-white/10 text-white hover:bg-white/20'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p aria-live="polite" className="mt-3 min-h-4 text-xs text-slate-300">{pollReplies[confidence] || ''}</p>
            </div>
            {phase === 'ready' ? (
              <button type="button" onClick={() => pending.current && reveal(pending.current)}
                className="mt-6 w-full rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-black text-[#102b4d] shadow-lg shadow-amber-300/20 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Okay, reveal my marks 👀
              </button>
            ) : (
              <button type="button" onClick={skipSuspense} disabled={skipPending}
                className="mt-5 text-xs font-bold text-slate-300 underline underline-offset-4 hover:text-white disabled:no-underline disabled:opacity-60">
                {skipPending ? 'Waiting for the result…' : 'Skip the suspense'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
