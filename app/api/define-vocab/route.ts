import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is missing.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { word, contextSentence } = body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      return NextResponse.json(
        { error: 'Word parameter is required.' },
        { status: 400 }
      );
    }

    const cleanWord = word.trim();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert SAT Vocabulary Tutor. Analyze the vocabulary word "${cleanWord}"${
      contextSentence ? ` in the context of this sentence: "${contextSentence}"` : ''
    }. Provide a precise, SAT-tailored definition, part of speech, a clear example sentence, 3-5 synonyms, and a helpful tip for SAT test takers.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: 'The exact word or phrase being defined' },
            definition: { type: Type.STRING, description: 'Clear, concise SAT-level definition' },
            partOfSpeech: { type: Type.STRING, description: 'Part of speech (e.g. adjective, noun, verb, adverb)' },
            exampleSentence: { type: Type.STRING, description: 'Example sentence demonstrating correct usage' },
            synonyms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-5 closely related synonyms',
            },
            satTip: { type: Type.STRING, description: 'Tip for SAT context, tone, or common traps' },
          },
          required: ['word', 'definition', 'partOfSpeech', 'exampleSentence', 'synonyms'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini model returned empty response.');
    }

    const parsedData = JSON.parse(responseText);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error defining vocabulary word:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to auto-generate vocabulary definition.' },
      { status: 500 }
    );
  }
}
