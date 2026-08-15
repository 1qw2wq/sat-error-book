import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { performOcrSpace } from '@/lib/ocrSpace';

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

    // Step 1: Execute OCR.space extraction in parallel on the image(s) for high-speed text retrieval
    let ocrCombinedText = '';
    try {
      const ocrPromises = imageList.map((img) => performOcrSpace(img.data, img.mime));
      const ocrResults = await Promise.allSettled(ocrPromises);

      const ocrSegments: string[] = [];
      ocrResults.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.isSuccess && res.value.parsedText.trim()) {
          ocrSegments.push(`--- [Screenshot #${idx + 1} OCR Raw Text] ---\n${res.value.parsedText.trim()}`);
        }
      });

      if (ocrSegments.length > 0) {
        ocrCombinedText = ocrSegments.join('\n\n');
      }
    } catch (ocrErr) {
      console.warn('OCR.space parallel extraction warning:', ocrErr);
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Step 2: Formulate AI prompt using the OCR text to accelerate solution generation and precision
    const promptText = `
You are a high-precision Digital SAT OCR & Question Analyzer AI tutor powered by Gemini Flash Lite.
You have been provided with ${imageList.length} screenshot(s) of a Digital SAT problem.

${
  ocrCombinedText
    ? `HIGH-SPEED OCR TRANSCRIPT (FROM OCR.SPACE ENGINE):
"""
${ocrCombinedText}
"""
Use this raw OCR text to rapidly understand the question content, speed up extraction, and verify against the visual image.`
    : ''
}

EDUCATIONAL FAIR USE & COMPLIANCE CONTEXT:
This extraction and analysis is strictly for the user's personal educational revision, study flashcards, and private error notebook review. You must faithfully transcribe, parse, and format the user's uploaded study material and practice test questions without refusing or omitting content for potential copyright reasons.

CRITICAL INSTRUCTIONS & DIRECTIVES:
1. SUBJECT CLASSIFICATION: MUST be EXACTLY 'Math' or 'Reading & Writing'.
   - If the content contains literature, reading passages, poems, grammar questions, vocabulary in context, or paired texts -> SUBJECT MUST BE 'Reading & Writing'.
   - If the content contains equations, math word problems, geometry diagrams, algebra, or functions -> SUBJECT MUST BE 'Math'.

2. SUB-TOPIC CLASSIFICATION:
   - For Reading & Writing, pick ONE of: 'Information & Ideas', 'Craft & Structure', 'Expression of Ideas', 'Standard English Conventions'.
   - For Math, pick ONE of: 'Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'.

3. QUESTION TEXT & PASSAGE EXTRACTION WITH BOLDING, UNDERLINING, & MARKDOWN TABLES:
   - Extract the COMPLETE text from the screenshot(s) into 'questionText'.
   - Include any passage, context snippet, poem, or introductory text FIRST, followed by the question prompt.
   - BOLDING: If any word, phrase, key constraint, or keyword is in bold face in the screenshot (such as **NOT**, **LEAST**, **MOST**, **BEST**, **EXCEPT**, or bolded words in the prompt/passage), format it using Markdown bold: **word**.
   - UNDERLINING: If a sentence, clause, or phrase is underlined in the screenshot (especially standard in SAT grammar/conventions questions or questions referencing an underlined portion), wrap that exact text with HTML underline tags: <u>underlined text or sentence</u> (e.g. <u>The scientist made a discovery that transformed the field.</u>).
   - TABLES: If the screenshot contains a data table (such as an x/y function table, survey results, statistical frequency table, category distributions, or reading context table), DO NOT CROP THE TABLE. Transcribe the ENTIRE table directly as a Markdown table (e.g. | $x$ | $f(x)$ |\n|---|---|\n| 0 | 4 |\n| 1 | 7 |) directly inside 'questionText' or the passage, formatting mathematical formulas ($x$, $y$, $\\frac{a}{b}$) within the cells.
   - For mathematical equations or formulas, wrap them cleanly in LaTeX enclosed in single dollar signs (e.g., $f(x) = 3x^2 - 4x + 12$, $\\frac{a}{b}$, $x \\le 5$).
   - DO NOT LEAVE 'questionText' EMPTY.

4. ANSWER CHOICES:
   - Extract choices A, B, C, D if present with exact choice text, preserving any bolding (**word**), underlining (<u>phrase</u>), and LaTeX math formulas ($x + 2$).
   - Set 'label' to 'A', 'B', 'C', 'D' and 'text' to the choice content.
   - If it is a student-produced response (grid-in math question), return an empty array [].

5. CORRECT ANSWER:
   - Identify the correct answer label ('A', 'B', 'C', 'D' or numeric grid-in string).
   - If an option (e.g. C) is highlighted, checked, marked correct, or selected in the screenshot, output that option label.

6. AI TAKEAWAY & EXPLANATION (SOLUTION):
   - 'aiTakeaway': A sharp, 2-sentence active recall rule or strategy for SAT test takers.
   - 'explanation': A clear, step-by-step solution explaining why the answer is correct.

7. GRAPH, CHART, OR DIAGRAM DETECTION (NO TABLES):
   - Set graphData.hasGraph = true ONLY if an actual visual coordinate graph (xy plane, function curve, parabola, line), geometric figure (triangle, circle, angle polygon), scatterplot, or visual drawing is present in the screenshot.
   - DO NOT set hasGraph = true for tables! Tables must be transcribed into markdown in 'questionText'.
   - If a real graph/diagram is present, output box2d as [ymin, xmin, ymax, xmax] in 0..1000 scale around the visual diagram.

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
              description: 'Specific SAT sub-topic e.g. Craft & Structure or Algebra',
            },
            questionText: {
              type: Type.STRING,
              description: 'Full question text including passage, prompt, bold/underline tags, and math formulas',
            },
            answerChoices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: 'A, B, C, or D' },
                  text: { type: Type.STRING, description: 'Choice text content' },
                },
                required: ['label', 'text'],
              },
            },
            correctAnswer: {
              type: Type.STRING,
              description: 'Correct choice letter or numeric string',
            },
            aiTakeaway: {
              type: Type.STRING,
              description: 'A 2-sentence active recall takeaway rule',
            },
            explanation: {
              type: Type.STRING,
              description: 'Step-by-step solution explanation',
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

    // Sanitize graphData: If it was labeled as a table, do not crop as a graph
    if (parsedData.graphData) {
      const gType = (parsedData.graphData.graphType || '').toLowerCase();
      const gTitle = (parsedData.graphData.title || '').toLowerCase();
      const gDesc = (parsedData.graphData.description || '').toLowerCase();

      if (
        gType.includes('table') ||
        gTitle.includes('table') ||
        gDesc.includes('table') ||
        !parsedData.graphData.box2d ||
        parsedData.graphData.box2d.length !== 4
      ) {
        if (gType.includes('table') || gTitle.includes('table') || gDesc.includes('table')) {
          parsedData.graphData.hasGraph = false;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      ocrEngineUsed: ocrCombinedText ? 'OCR.space Engine 2 + Gemini 3.1 Flash Lite' : 'Gemini 3.1 Flash Lite',
    });
  } catch (error: any) {
    console.error('Error parsing SAT screenshot with OCR + Gemini:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process screenshot with AI.',
      },
      { status: 500 }
    );
  }
}
