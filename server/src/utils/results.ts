export interface ExamScore {
  type: string;
  examDate: string;
  earned: number;
  maximum: number;
}

export interface CourseMarks {
  semester: string;
  course: string;
  exams: ExamScore[];
}

export function rollNumberFromEmail(email: string): string | null {
  const match = email.trim().match(/^([a-z0-9]{11})@wilp\.bits-pilani\.ac\.in$/i);
  return match ? match[1].toUpperCase() : null;
}

export function examGroup(type: string): string {
  const match = type.match(/^(EC\d+)[MR]$/i);
  return match ? match[1].toUpperCase() : type;
}

export function extractMarks(payload: unknown): { name: string | null; rows: CourseMarks[] } {
  if (!payload || typeof payload !== 'object') throw new Error('Unexpected results response');
  const source = payload as Record<string, unknown>;
  if (!source.courses || typeof source.courses !== 'object') throw new Error('Unexpected results response');

  const courses = new Map<string, CourseMarks & { semesterOrder: number }>();
  for (const raw of Object.values(source.courses as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, any>;
    const code = String(entry.code || '').replace(/\s+/g, '').toUpperCase();
    const type = String(entry.examType || code.match(/-([A-Z0-9]+)$/)?.[1] || '').trim().toUpperCase();
    if (!code || !type) continue;
    const baseCode = code.endsWith(`-${type}`) ? code.slice(0, -type.length - 1) : code;
    const domain = String(entry.domain || '').trim();
    const termMatch = domain.match(/(?:^|[^A-Z0-9])S(\d{1,2})[-_](20\d{2}|\d{2})(?=$|[^0-9])/i);
    const termNumber = termMatch ? Number(termMatch[1]) : null;
    const year = termMatch ? Number(termMatch[2].length === 2 ? `20${termMatch[2]}` : termMatch[2]) : null;
    const semester = termMatch ? `S${termNumber} ${year}` : (domain || 'Term not specified');
    const semesterOrder = termMatch ? year! * 100 + termNumber! : 0;

    const sample = entry.revaluationMarksSample;
    const items = sample?.items;
    const earned = Number(sample?.totalMarks);
    if (!Array.isArray(items) || !Number.isFinite(earned)) continue;
    const maximum = items.reduce((sum: number, item: any) => sum + Number(item?.MaxMarks ?? 0), 0);
    if (!Number.isFinite(maximum) || maximum <= 0) continue;

    const key = `${semester}::${baseCode}`;
    const row = courses.get(key) || {
      semester,
      semesterOrder,
      course: String(entry.subject || baseCode).slice(0, 150),
      exams: [],
    };
    const examDate = String(entry.examDate || entry.examSlot?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || '').trim().slice(0, 30);
    const duplicate = row.exams.some((exam) =>
      exam.type === type && exam.examDate === examDate && exam.earned === earned && exam.maximum === maximum
    );
    if (!duplicate) row.exams.push({ type, examDate, earned, maximum });
    courses.set(key, row);
  }

  const rows = [...courses.values()]
    .sort((a, b) => b.semesterOrder - a.semesterOrder || a.semester.localeCompare(b.semester) || a.course.localeCompare(b.course))
    .map(({ semesterOrder: _semesterOrder, ...row }) => ({
      ...row,
      exams: row.exams.sort((a, b) => a.type.localeCompare(b.type, undefined, { numeric: true }) || a.examDate.localeCompare(b.examDate)),
    }));
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 100) : null;
  return { name, rows };
}
