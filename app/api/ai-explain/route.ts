import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const {
      questionText,
      passageText,
      choices,
      correctAnswer,
      userSelectedAnswer,
      aiTakeaway,
      explanation,
      userPrompt,
      subject,
      subTopic,
      mode = 'general',
    } = await req.json();

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let prompt = '';

    if (mode === 'answer_analysis' || mode === 'deep_analysis') {
      const choicesStr = Array.isArray(choices)
        ? choices
            .map((c: any, i: number) => {
              if (typeof c === 'string') {
                return `Choice ${String.fromCharCode(65 + i)}: ${c}`;
              }
              return `Choice ${c.label || String.fromCharCode(65 + i)}: ${c.text || ''}`;
            })
            .join('\n')
        : 'N/A (Student-Produced Response / Grid-in)';

      prompt = `
You are a world-class SAT 1600 master instructor and test analyst.
Generate a comprehensive, crystal-clear **Answer Analysis & Trap Breakdown** for the following SAT question.

### Question Context:
- Subject: ${subject || 'SAT'}
- Topic: ${subTopic || 'Core Concept'}
${passageText ? `- Reading Passage:\n"""\n${passageText}\n"""\n` : ''}
- Question Prompt:
"""
${questionText}
"""

- Options:
${choicesStr}

- Official Correct Answer: ${correctAnswer || 'Not explicitly provided'}
${userSelectedAnswer ? `- Student's Selected Answer: ${userSelectedAnswer}` : ''}
${explanation ? `- Existing Reference Notes:\n${explanation}` : ''}

---

### Format your response in clean, readable Markdown with these 4 sections:

### 1. 🎯 Core Concept Tested
State in 1-2 precise sentences the exact SAT rule, formula, or grammar/logic principle being tested.

### 2. 📝 Step-by-Step Solution
Walk through the logical or mathematical proof step by step. Use clean LaTeX formatting for all mathematical equations wrapped in single dollar signs like \`$x = 4$\` or \`$\\frac{a}{b}$\`.

### 3. 🔍 Option & Trap Breakdown
- Explain why the **Correct Answer** is unequivocally right.
- For each incorrect choice (or common student mistakes), explain the specific College Board trap (e.g., misreading variables, sign errors, scope shift, extreme words, partial computation).

### 4. 💡 Active Recall Takeaway
Give a 1-sentence memorable rule or speed shortcut so the student never misses this type of problem again on test day.
`;
    } else {
      prompt = `
You are an expert, encouraging SAT tutor assistant.
The student is reviewing a question:
Question: "${questionText}"
Key Takeaway: "${aiTakeaway || ''}"
Original Explanation: "${explanation || ''}"

Student query: "${userPrompt}"

Provide a clear, direct, and actionable answer in 2-4 short paragraphs or bullet points. If requested, provide a similar practice problem with solution. Use LaTeX \`$formula$\` for math expressions.
`;
    }

    // Attempt with gemini-3.7-flash, fallback to gemini-3.1-flash-lite if needed
    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });
      responseText = response.text || '';
    } catch (primaryErr) {
      console.warn('Falling back to gemini-3.1-flash-lite:', primaryErr);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });
      responseText = fallbackResponse.text || '';
    }

    return NextResponse.json({
      text: responseText || 'I could not generate an analysis. Please try again.',
    });
  } catch (error: any) {
    console.error('AI Explain error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get explanation.' },
      { status: 500 }
    );
  }
}
