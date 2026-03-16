export const SEMESTERS = ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8'];

export const SUBJECTS_BY_SEM: Record<string, string[]> = {
  'Sem1': ['Probability & Statistics', 'Electrical Science', 'Writing Practice', 'Symbolic Logic'],
  'Sem2': ['Computer Programming', 'Discrete Structures for Computer Science', 'Environmental Studies', 'Dynamics of Social Change'],
  'Sem3': ['Digital Design', 'Creative Thinking', 'Linear Algebra & Optimization', 'Data Structures'],
  'Sem4': ['Cultural Studies', 'Evolution of Design', 'Object Oriented Programming & Design', 'Computer Organization & Architecture'],
  'Sem5': ['Algorithm Design', 'Critical Analysis of Literature & Cinema', 'Humanities and Design', 'Operating Systems (Elective)'],
  'Sem6': ['Computing and Design', 'Statistical Inferences & Applications', 'Software Design Principles', 'Database Design (Elective)'],
  'Sem7': ['Information Security', 'Human Computer Interaction', 'Computer Networks (Elective)'],
  'Sem8': ['Capstone Project'],
};

export const RESOURCE_CATEGORIES = [
  { id: 'midsem', label: 'Mid-Sem' },
  { id: 'endsem', label: 'End-Sem' },
  { id: 'ppt', label: 'BITS PPTs' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'quiz', label: 'Quizzes' },
];
