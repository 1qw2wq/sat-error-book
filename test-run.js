const fs = require('fs');
const ts = require('typescript');

const tsSource = fs.readFileSync('./lib/mathFormatter.ts', 'utf8');
const js = ts.transpileModule(tsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const moduleExports = {};
const moduleFunc = new Function('exports', 'module', js);
const mod = { exports: moduleExports };
moduleFunc(moduleExports, mod);

const { formatMathText, formatMathChoice, cleanMathExpr } = mod.exports;

const qs = JSON.parse(fs.readFileSync('./all_questions.json', 'utf8'));

[798672, 798686, 798688, 800101].forEach(id => {
  const q = qs.find(x => x.question_id === id);
  console.log('\n================ ID: ' + id + ' ================');
  console.log('RAW QUESTION:', q.question);
  console.log('FORMATTED QUESTION:\n', formatMathText(q.question));
  console.log('RAW SELECTIONS:', q.selections);
  const formattedSel = (q.selections || []).map(s => formatMathChoice(s));
  console.log('FORMATTED SELECTIONS:\n', formattedSel);
});
