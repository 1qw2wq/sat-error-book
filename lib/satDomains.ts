import { RawSATQuestion } from '@/types/sat';

export interface SATDomainConfig {
  id: string;
  name: string;
  section: 'Reading and Writing' | 'Math';
  description: string;
  keywords: RegExp;
}

export const SAT_DOMAINS: SATDomainConfig[] = [
  // Reading & Writing Domains
  {
    id: 'rw_words_in_context',
    name: 'Craft & Structure: Words in Context',
    section: 'Reading and Writing',
    description: 'High-frequency vocabulary, secondary word meanings, and contextual precision.',
    keywords: /(?:which choice completes the text with the most logical and precise word|most logical and precise word|vocabulary in context|precise word or phrase|logical and precise word)/i,
  },
  {
    id: 'rw_text_structure',
    name: 'Craft & Structure: Text Structure & Purpose',
    section: 'Reading and Writing',
    description: 'Rhetorical purpose, structural shift, paragraph organization, and author intent.',
    keywords: /(?:which choice best describes the function of the underlined|overall structure of the text|main purpose of the text|function of the portion|function of the second sentence|describes the relationship between the two paragraphs|main purpose of the passage|function of the underlined)/i,
  },
  {
    id: 'rw_cross_text',
    name: 'Craft & Structure: Cross-Text Connections',
    section: 'Reading and Writing',
    description: 'Comparing viewpoints, syntheses, and contrasting claims between Text 1 & Text 2.',
    keywords: /(?:based on the texts|Text 1 and Text 2|both authors would most likely|author of Text 2 would most likely respond|how would the author of Text 2)/i,
  },
  {
    id: 'rw_central_ideas',
    name: 'Information & Ideas: Central Ideas & Details',
    section: 'Reading and Writing',
    description: 'Main claims, passage takeaways, implicit arguments, and supporting details.',
    keywords: /(?:which choice best describes the main idea|central idea of the text|according to the text|primary argument|main idea of the text|passage indicates that|states that)/i,
  },
  {
    id: 'rw_command_evidence',
    name: 'Information & Ideas: Command of Evidence',
    section: 'Reading and Writing',
    description: 'Evaluating textual and quantitative evidence, charts, graphs, and hypothesis support.',
    keywords: /(?:which finding.*if true.*would support|would most strongly support the|which choice best describes data from the table|evidence that supports|which choice best illustrates the claim|which finding.*support|data in the table|data in the graph|support the researcher|strengthen the argument)/i,
  },
  {
    id: 'rw_inferences',
    name: 'Information & Ideas: Inferences',
    section: 'Reading and Writing',
    description: 'Drawing logical conclusions and predicting outcomes supported by the passage.',
    keywords: /(?:which choice most logically completes the text|it can reasonably be inferred|suggests that|completes the argument|most logically completes the text)/i,
  },
  {
    id: 'rw_standard_english',
    name: 'Standard English Conventions (Grammar & Punctuation)',
    section: 'Reading and Writing',
    description: 'Sentence boundaries, subject-verb agreement, modifier placement, and punctuation rules.',
    keywords: /(?:conventions of standard english|which choice conforms to the conventions|punctuation|semicolon|comma splice|subject-verb agreement|verb tense|plural form)/i,
  },
  {
    id: 'rw_transitions',
    name: 'Expression of Ideas: Transitions',
    section: 'Reading and Writing',
    description: 'Logical flow words (However, Furthermore, Consequently, For instance).',
    keywords: /(?:most logical transition|which choice completes the text with the most logical transition|transitional word|transition)/i,
  },
  {
    id: 'rw_rhetorical_synthesis',
    name: 'Expression of Ideas: Rhetorical Synthesis (Student Notes)',
    section: 'Reading and Writing',
    description: 'Selecting relevant bullet points to accomplish specific writing goals.',
    keywords: /(?:while researching a topic, a student has taken the following notes|student wants to|using information from the notes|student has taken the following notes)/i,
  },

  // Math Domains
  {
    id: 'math_algebra',
    name: 'Algebra: Linear Equations & Functions',
    section: 'Math',
    description: 'Linear equations in one/two variables, linear functions, inequalities, and systems.',
    keywords: /(?:linear|slope|system of equations|line in the xy-plane|xy-plane|y-intercept|x-intercept|intercept|equation represents|system represents|total of|each month|per hour|miles per gallon|dollars per)/i,
  },
  {
    id: 'math_advanced_math',
    name: 'Advanced Math: Quadratics & Nonlinear Functions',
    section: 'Math',
    description: 'Quadratic equations, polynomials, exponential growth/decay, radicals, and rational expressions.',
    keywords: /(?:quadratic|parabola|vertex|discriminant|exponential|f\s*\(\s*[x0-9]+\s*\)|g\s*\(\s*[x0-9]+\s*\)|h\s*\(\s*[x0-9]+\s*\)|p\s*\(\s*[x0-9]+\s*\)|C\s*\(\s*[x0-9]+\s*\)|x\s*2|x\^2|sqrt|radical|polynomial|nonlinear|equivalent to|solution to the equation|solutions to the equation)/i,
  },
  {
    id: 'math_problem_solving',
    name: 'Problem-Solving & Data Analysis (Stats & Ratios)',
    section: 'Math',
    description: 'Ratios, rates, percentages, probability, statistics, scatterplots, and data tables.',
    keywords: /(?:probability|percent|%|ratio|rate|mean|median|mode|standard deviation|scatter|sample|margin of error|proportional|confidence interval|frequency|table gives|survey|whales in a population|population|estimated number)/i,
  },
  {
    id: 'math_geometry_trig',
    name: 'Geometry & Trigonometry',
    section: 'Math',
    description: 'Triangles, circles, area/volume, right-triangle trigonometry, radians, and angles.',
    keywords: /(?:triangle|circle|radius|diameter|angle|perimeter|volume|area|cylinder|sphere|radians|degree|degrees|sine|cosine|tangent|trigonometry|hypotenuse|parallel|perpendicular|length of|segment|arc)/i,
  },
];

/**
 * Classifies an SAT Question into its specific domain/skill based on text, section, and patterns.
 */
export function classifyQuestionDomain(q: {
  question?: string;
  explanations?: string;
  section?: string;
  graphs?: any;
}): string {
  const combined = `${q.question || ''} ${q.explanations || ''}`;
  const section = q.section || '';

  const candidates = SAT_DOMAINS.filter((d) =>
    section === 'Reading and Writing'
      ? d.section === 'Reading and Writing'
      : d.section === 'Math'
  );

  for (const domain of candidates) {
    if (domain.keywords.test(combined)) {
      return domain.name;
    }
  }

  // Fallback defaults
  if (section === 'Reading and Writing') {
    return 'Reading & Writing: General Comprehension';
  }
  return 'Algebra: Linear Equations & Functions';
}
