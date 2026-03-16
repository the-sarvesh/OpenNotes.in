export const SEMESTERS = ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8'];

export const SUBJECTS_BY_SEM: Record<string, string[]> = {
  'Sem1': ['BSDCH ZC111: Probability & Statistics', 'BSDCH ZC112: Electrical Science', 'BSDCH ZC151: Writing Practice', 'BSDCH ZC236: Symbolic Logic'],
  'Sem2': ['BSDCH ZC142: Computer Programming', 'BSDCH ZC222: Discrete Structures for Computer Science', 'BSDCH ZC225: Environmental Studies', 'BSDCH ZC231: Dynamics of Social Change'],
  'Sem3': ['BSDCH ZC215: Digital Design', 'BSDCH ZC226: Creative Thinking', 'BSDCH ZC234: Linear Algebra & Optimization', 'BSDCH ZC356: Data Structures'],
  'Sem4': ['BSDCH ZC242: Cultural Studies', 'BSDCH ZC312: Evolution of Design', 'BSDCH ZC313: Object Oriented Programming & Design', 'BSDCH ZC353: Computer Organization & Architecture'],
  'Sem5': ['BSDCH ZC317: Algorithm Design', 'BSDCH ZC322: Critical Analysis of Literature & Cinema', 'BSDCH ZC328: Humanities and Design', 'BSDCH ZC364: Operating Systems (Elective)'],
  'Sem6': ['BSDCH ZC316: Computing and Design', 'BSDCH ZC355: Statistical Inferences & Applications', 'BSDCH ZC412: Software Design Principles', 'BSDCH ZC413: Database Design (Elective)'],
  'Sem7': ['BSDCH ZC311: Information Security', 'BSDCH ZC365: Human Computer Interaction', 'BSDCH ZC481: Computer Networks (Elective)'],
  'Sem8': ['BSDCH ZC499T: Capstone Project'],
};

export const RESOURCE_CATEGORIES = [
  { id: 'midsem', label: 'Mid-Sem' },
  { id: 'endsem', label: 'End-Sem' },
  { id: 'ppt', label: 'BITS PPTs' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'quiz', label: 'Quizzes' },
];
