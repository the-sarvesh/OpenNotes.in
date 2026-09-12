export const SEMESTER_KEYS = ["Sem1", "Sem2", "Sem3", "Sem4", "Sem5", "Sem6", "Sem7", "Sem8"] as const;

export const DEFAULT_SUBJECTS_BY_SEM: Record<string, string[]> = {
  Sem1: ["Probability & Statistics", "Electrical Science", "Writing Practice", "Symbolic Logic"],
  Sem2: ["Computer Programming", "Discrete Structures for Computer Science", "Environmental Studies", "Dynamics of Social Change"],
  Sem3: ["Digital Design", "Creative Thinking", "Linear Algebra & Optimization", "Data Structures"],
  Sem4: ["Cultural Studies", "Evolution of Design", "Object Oriented Programming & Design", "Computer Organization & Architecture"],
  Sem5: ["Algorithm Design", "Critical Analysis of Literature & Cinema", "Humanities and Design", "Operating Systems (Elective)"],
  Sem6: ["Computing and Design", "Statistical Inferences & Applications", "Software Design Principles", "Database Design (Elective)"],
  Sem7: ["Information Security", "Human Computer Interaction", "Computer Networks (Elective)", "Software Engineering"],
  Sem8: ["Capstone Project"],
};

export const validateSubjectCatalog = (value: unknown): value is Record<string, string[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== SEMESTER_KEYS.length) return false;

  return SEMESTER_KEYS.every((semester) => {
    const subjects = (value as Record<string, unknown>)[semester];
    return Array.isArray(subjects) &&
      subjects.length <= 30 &&
      subjects.every((subject) =>
        typeof subject === "string" && subject.trim().length >= 2 && subject.trim().length <= 120,
      );
  });
};

export const normalizeSubjectCatalog = (catalog: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(SEMESTER_KEYS.map((semester) => {
    const normalized = catalog[semester]
      .map((subject) => subject.trim())
      .filter((subject, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === subject.toLowerCase()) === index,
      );
    return [semester, normalized];
  }));
