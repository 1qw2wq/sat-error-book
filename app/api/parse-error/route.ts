import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

function cleanMimeType(rawMime?: string): string {
  if (!rawMime) return 'image/png';
  let cleaned = rawMime.replace(/^data:/i, '').split(';')[0].trim().toLowerCase();
  if (cleaned === 'image/jpg') return 'image/jpeg';
  if (['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(cleaned)) {
    return cleaned;
  }
  return 'image/png';
}

function extractImageBase64AndMime(input: any, defaultMime = 'image/png'): { data: string; mime: string } | null {
  if (!input) return null;
  let rawStr = typeof input === 'string' ? input : input.image || input.dataUrl || input.url || '';
  let rawMime = typeof input === 'object' ? input.mimeType || defaultMime : defaultMime;

  if (!rawStr || typeof rawStr !== 'string') return null;

  let mime = cleanMimeType(rawMime);
  let base64 = rawStr.trim();

  if (base64.includes(';base64,')) {
    const parts = base64.split(';base64,');
    mime = cleanMimeType(parts[0]);
    base64 = parts[1];
  } else if (base64.startsWith('data:')) {
    const parts = base64.split(',');
    mime = cleanMimeType(parts[0]);
    base64 = parts[1] || parts[0];
  }

  // Strip whitespace and line breaks
  base64 = base64.replace(/\s+/g, '');
  if (!base64) return null;

  return { data: base64, mime };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { image, images: rawImages, mimeType, userNote } = body;

    // Collect image inputs into standard array
    const imageList: Array<{ data: string; mime: string }> = [];

    if (Array.isArray(rawImages) && rawImages.length > 0) {
      for (const imgItem of rawImages) {
        const extracted = extractImageBase64AndMime(imgItem, mimeType);
        if (extracted) imageList.push(extracted);
      }
    }

    if (imageList.length === 0 && image) {
      const extracted = extractImageBase64AndMime(image, mimeType);
      if (extracted) imageList.push(extracted);
    }

    if (imageList.length === 0) {
      return NextResponse.json(
        { error: 'At least one screenshot image is required.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = `
You are a high-precision Digital SAT OCR & Question Analyzer AI tutor powered by Gemini 3.1 Flash Lite.
Analyze the provided ${imageList.length} screenshot(s) of a Digital SAT (College Board Bluebook / Khan Academy / Practice Test) problem.

CRITICAL INSTRUCTIONS & DIRECTIVES:
1. SUBJECT CLASSIFICATION: MUST be EXACTLY 'Math' or 'Reading & Writing'.
   - If the image contains literature, reading passages, poems, grammar questions, vocabulary in context, or paired texts -> SUBJECT MUST BE 'Reading & Writing'.
   - If the image contains equations, math word problems, geometry diagrams, algebra, or functions -> SUBJECT MUST BE 'Math'.

2. SUB-TOPIC CLASSIFICATION:
   - For Reading & Writing, pick ONE of: 'Information & Ideas', 'Craft & Structure', 'Expression of Ideas', 'Standard English Conventions'.
   - For Math, pick ONE of: 'Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'.

3. QUESTION TEXT & PASSAGE EXTRACTION:
   - Extract the COMPLETE visible text from the screenshot(s) into 'questionText'.
   - Include any passage, context snippet, poem, or introductory text FIRST, followed by the question prompt.
   - For mathematical equations or formulas, wrap them cleanly in LaTeX enclosed in single dollar signs (e.g., $f(x) = 3x^2 - 4x + 12$, $\\frac{a}{b}$, $x \\le 5$).
   - DO NOT LEAVE 'questionText' EMPTY.

4. ANSWER CHOICES:
   - Extract choices A, B, C, D if present with exact choice text and LaTeX for math formulas.
   - Set 'label' to 'A', 'B', 'C', 'D' and 'text' to the choice content.
   - If it is a student-produced response (grid-in math question), return an empty array [].

5. CORRECT ANSWER:
   - Identify the correct answer label ('A', 'B', 'C', 'D' or numeric grid-in string).
   - If an option (e.g. C) is highlighted, checked, marked correct, or selected in the screenshot, output that option label.

6. AI TAKEAWAY & EXPLANATION:
   - 'aiTakeaway': A sharp, 2-sentence active recall rule or strategy for SAT test takers.
   - 'explanation': A clear, step-by-step solution explaining why the answer is correct.

7. GRAPH, CHART, OR DIAGRAM DETECTION:
   - Set graphData.hasGraph = true ONLY if a visual coordinate graph, bar chart, scatterplot, geometric diagram, or data table is present in the screenshot.
   - If present, output box2d as [ymin, xmin, ymax, xmax] in 0..1000 scale around the visual diagram.

${userNote ? `User context/note: "${userNote}"` : ''}
`;

    // Prepare multimodal content payload
    const contents: any[] = [];
    for (const imgObj of imageList) {
      contents.push({
        inlineData: {
          mimeType: imgObj.mime,
          data: imgObj.data,
        },
      });
    }
    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              enum: ['Math', 'Reading & Writing'],
            },
            subTopic: {
              type: Type.STRING,
              description: "Specific SAT sub-topic e.g. Craft & Structure or Algebra",
            },
            questionText: {
              type: Type.STRING,
              description: "Full question text including passage, prompt, and math formulas",
            },
            answerChoices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "A, B, C, or D" },
                  text: { type: Type.STRING, description: "Choice text content" },
                },
                required: ['label', 'text'],
              },
            },
            correctAnswer: {
              type: Type.STRING,
              description: "Correct choice letter or numeric string",
            },
            aiTakeaway: {
              type: Type.STRING,
              description: "A 2-sentence active recall takeaway rule",
            },
            explanation: {
              type: Type.STRING,
              description: "Step-by-step solution explanation",
            },
            graphData: {
              type: Type.OBJECT,
              properties: {
                hasGraph: { type: Type.BOOLEAN },
                graphType: { type: Type.STRING },
                title: { type: Type.STRING },
                xAxisLabel: { type: Type.STRING },
                yAxisLabel: { type: Type.STRING },
                equation: { type: Type.STRING },
                description: { type: Type.STRING },
                imageIndex: { type: Type.INTEGER },
                box2d: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
            },
            mistakeTypeHint: {
              type: Type.STRING,
              enum: ['Careless Error', 'Concept Gap', 'Misread Question', 'Time Pressure', 'Calculation Error', 'Formula Amnesia'],
            },
            difficulty: {
              type: Type.STRING,
              enum: ['Easy', 'Medium', 'Hard'],
            },
          },
          required: ['subject', 'subTopic', 'questionText', 'correctAnswer', 'aiTakeaway', 'explanation', 'answerChoices'],
        },
      },
    });

    const jsonText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(jsonText);

    // Sanitize answer choices if needed
    if (Array.isArray(parsedData.answerChoices)) {
      parsedData.answerChoices = parsedData.answerChoices.map((choice: any, index: number) => {
        if (typeof choice === 'string') {
          const match = choice.match(/^([A-D])[\s\):\.-]+(.*)$/i);
          if (match) {
            return { label: match[1].toUpperCase(), text: match[2].trim() };
          }
          const defaultLabel = String.fromCharCode(65 + index);
          return { label: defaultLabel, text: choice.trim() };
        }
        return {
          label: (choice.label || String.fromCharCode(65 + index)).toUpperCase(),
          text: choice.text || '',
        };
      });
    } else {
      parsedData.answerChoices = [];
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error parsing SAT screenshot with Gemini:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process screenshot with AI.',
      },
      { status: 500 }
    );
  }
}
