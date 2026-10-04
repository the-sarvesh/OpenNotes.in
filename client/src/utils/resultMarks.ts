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

export const examGroup = (type: string) => type.match(/^(EC\d+)[MR]$/i)?.[1].toUpperCase() || type;

export const attemptLabel = (type: string) =>
  /^EC\d+M$/i.test(type) ? 'Makeup' : /^EC\d+R$/i.test(type) ? 'Regular' : type;

export const sumScores = (scores: ExamScore[]) => ({
  earned: Number(scores.reduce((sum, score) => sum + score.earned, 0).toFixed(2)),
  maximum: scores.reduce((sum, score) => sum + score.maximum, 0),
});
