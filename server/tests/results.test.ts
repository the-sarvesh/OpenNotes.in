import assert from "node:assert/strict";
import test from "node:test";
import { extractMarks, rollNumberFromEmail } from "../src/utils/results.js";
import { attemptLabel, examGroup, sumScores } from "../../client/src/utils/resultMarks.js";

test("results lookup derives only the signed-in WILP roll number", () => {
  assert.equal(rollNumberFromEmail("202217b3002@wilp.bits-pilani.ac.in"), "202217B3002");
  assert.equal(rollNumberFromEmail("202217b3002@gmail.com"), null);
  assert.equal(rollNumberFromEmail("somebody@wilp.bits-pilani.ac.in"), null);
  assert.equal(rollNumberFromEmail("202217b3002@wilp.bits-pilani.ac.in.evil.test"), null);
});

test("regular and makeup attempts share a column without being summed twice", () => {
  const entry = (type: string, marks: number) => ({
    code: `BSDCHZC481-${type}`,
    examType: type,
    subject: "Computer Networks",
    domain: "HCL_COHORT(11)_S2-25_EC3R",
    examDate: "12/09/2026",
    revaluationMarksSample: {
      totalMarks: marks,
      items: [{ MaxMarks: 30 }],
    },
  });
  const result = extractMarks({
    name: "Student",
    courses: {
      first: entry("EC2R", 13),
      repeated: entry("EC2R", 13),
      makeup: entry("EC2M", 21),
      final: entry("EC3R", 15),
    },
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].exams.length, 3);
  assert.deepEqual(new Set(result.rows[0].exams.map((exam) => examGroup(exam.type))), new Set(["EC2", "EC3"]));
  assert.equal(attemptLabel("EC2M"), "Makeup");
  assert.equal(attemptLabel("EC2R"), "Regular");
  const ec2Attempts = result.rows[0].exams.filter((exam) => examGroup(exam.type) === "EC2");
  assert.equal(ec2Attempts.length, 2);
  assert.equal(ec2Attempts.length === 1 ? sumScores(ec2Attempts).earned : null, null);
});

test("other exam types stay distinct and single attempts can be totaled", () => {
  assert.equal(examGroup("EC3M"), "EC3");
  assert.equal(examGroup("EC3R"), "EC3");
  assert.equal(examGroup("QUIZ1"), "QUIZ1");
  assert.deepEqual(sumScores([
    { type: "EC2M", examDate: "", earned: 21, maximum: 30 },
    { type: "EC3R", examDate: "", earned: 15, maximum: 40 },
  ]), { earned: 36, maximum: 70 });
});
