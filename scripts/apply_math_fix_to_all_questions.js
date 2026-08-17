const fs = require('fs');
const path = require('path');
const { cleanMathText, cleanSelections, cleanExplanation } = require('./fix_math_json');

const jsonPath = path.join(__dirname, '..', 'all_questions.json');
const backupPath = path.join(__dirname, '..', 'all_questions.backup.json');

console.log('Reading all_questions.json from', jsonPath);
const raw = fs.readFileSync(jsonPath, 'utf8');
const questions = JSON.parse(raw);

console.log('Total questions before sanitization:', questions.length);

// 1. Create a backup first
fs.writeFileSync(backupPath, raw, 'utf8');
console.log('Created backup at', backupPath);

let mathCount = 0;
let modifiedCount = 0;

const updatedQuestions = questions.map((q) => {
  if (q.section !== 'Math') {
    return q;
  }

  mathCount++;
  const oldQ = q.question;
  const oldS = JSON.stringify(q.selections);
  const oldE = q.explanations;

  const newQuestion = cleanMathText(q.question);
  const newSelections = cleanSelections(q.selections);
  const newExplanation = cleanExplanation(q.explanations);

  if (
    newQuestion !== oldQ ||
    JSON.stringify(newSelections) !== oldS ||
    newExplanation !== oldE
  ) {
    modifiedCount++;
  }

  return {
    ...q,
    question: newQuestion,
    selections: newSelections,
    explanations: newExplanation,
  };
});

console.log(`Sanitized ${modifiedCount} out of ${mathCount} math questions.`);

// Write back to all_questions.json
fs.writeFileSync(jsonPath, JSON.stringify(updatedQuestions, null, 2), 'utf8');
console.log('Successfully written updated all_questions.json!');
