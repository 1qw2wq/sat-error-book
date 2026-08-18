const fs = require('fs');

// Read questions
const qs = JSON.parse(fs.readFileSync('./all_questions.json', 'utf8'));
const q1 = qs.find(q => q.question_id === 798672);
const q2 = qs.find(q => q.question_id === 798686);
const q3 = qs.find(q => q.question_id === 798688);
const q4 = qs.find(q => q.question_id === 800101);

console.log('Q1 raw:', q1.question);
console.log('Q1 sel:', q1.selections);
console.log('\nQ2 raw:', q2.question);
console.log('Q2 sel:', q2.selections);
console.log('\nQ3 raw:', q3.question);
console.log('Q3 sel:', q3.selections);
console.log('\nQ4 raw:', q4.question);
console.log('Q4 sel:', q4.selections);
