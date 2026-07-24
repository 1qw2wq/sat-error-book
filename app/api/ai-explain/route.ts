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

    const { questionText, aiTakeaway, explanation, userPrompt } = await req.json();

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemPrompt = `
You are an expert, encouraging SAT tutor assistant.
The student is reviewing a question they previously got wrong:
Question: "${questionText}"
Key Takeaway: "${aiTakeaway}"
Original Explanation: "${explanation}"

Student query: "${userPrompt}"

Provide a clear, direct, and actionable answer in 2-4 short paragraphs or bullet points. If requested, provide a similar practice problem with solution. Keep formatting clean and easy to read on mobile and desktop screens.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: systemPrompt,
    });

    return NextResponse.json({
      text: response.text || 'I could not generate an answer. Please try again.',
    });
  } catch (error: any) {
    console.error('AI Explain error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get explanation.' },
      { status: 500 }
    );
  }
}
