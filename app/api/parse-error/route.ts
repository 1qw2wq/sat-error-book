import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

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
        if (typeof imgItem === 'string') {
          let cleanBase64 = imgItem;
          let actualMime = mimeType || 'image/png';
          if (imgItem.includes(';base64,')) {
            const parts = imgItem.split(';base64,');
            actualMime = parts[0].replace('data:', '') || actualMime;
            cleanBase64 = parts[1];
          }
          imageList.push({ data: cleanBase64, mime: actualMime });
        } else if (imgItem?.image) {
          let cleanBase64 = imgItem.image;
          let actualMime = imgItem.mimeType || mimeType || 'image/png';
          if (cleanBase64.includes(';base64,')) {
            const parts = cleanBase64.split(';base64,');
            actualMime = parts[0].replace('data:', '') || actualMime;
            cleanBase64 = parts[1];
          }
          imageList.push({ data: cleanBase64, mime: actualMime });
        }
      }
    } else if (image) {
      let cleanBase64 = image;
      let actualMime = mimeType || 'image/png';
      if (image.includes(';base64,')) {
        const parts = image.split(';base64,');
        actualMime = parts[0].replace('data:', '') || actualMime;
        cleanBase64 = parts[1];
      }
      imageList.push({ data: cleanBase64, mime: actualMime });
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
You are a master Digital SAT OCR & Question Parsing AI tutor powered by Gemini 3.1 Flash Lite.
You are given ${imageList.length} screenshot(s) of a Digital SAT (College Board Bluebook / Khan Academy / Practice Test) problem.
If there are multiple screenshots provided, synthesize all information together seamlessly (e.g. passage from image 1, question stem & choices from image 2, or graphs/scratches across images).

Perform advanced high-precision OCR and extract all components:

CRITICAL OCR & SYNTHESIS DIRECTIVES:
1. Subject Classification: MUST be EXACTLY 'Math' or 'Reading & Writing'.
2. Sub-topic Classification:
   - For Math: 'Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', or 'Geometry & Trigonometry'.
   - For Reading & Writing: 'Information & Ideas', 'Craft & Structure', 'Expression of Ideas', or 'Standard English Conventions'.
3. Question Text & Math Formatting: Extract the FULL, un-truncated question stem and passage (if any).
   - Format ALL mathematical expressions and formulas cleanly using standard LaTeX enclosed in single dollar signs (e.g. $f(x) = 3x^2 - 4x + 12$, $\\frac{a}{b}$, $\\sqrt{x}$, $x \\le 5$, $(2, -1)$).
   - Retain complete line breaks and passage paragraphs accurately.
4. Answer Choices: Extract choices A, B, C, D if present with exact option text and LaTeX for math.
   - If it's a student-produced response (grid-in math question), return an empty array [].
5. Graph, Chart, or Data Table Extraction:
   - Carefully inspect the screenshot(s) for coordinate graphs, scatter plots, line graphs, bar charts, data tables, or geometric diagrams.
   - If a graph, table, or diagram is visible, set \`graphData.hasGraph = true\`.
   - Extract the equation (e.g. $y = -0.75x + 6$), axis labels, key points (e.g. x/y-intercepts, vertex, data points), or table headers & rows.
   - Provide a clear 1-2 sentence descriptive summary of the visual element in \`graphData.description\`.
6. Correct Answer:
   - Identify the single correct answer label ('A', 'B', 'C', 'D' or exact numerical string like '23' or '4/3').
   - If the screenshot shows correct/incorrect markings or selected answer annotations, utilize them. Otherwise, logically solve it step-by-step to determine the correct answer.
7. AI Takeaway ('aiTakeaway'): A sharp, 2-sentence active-recall memory rule or shortcut strategy that prevents repeating this mistake.
8. Detailed Explanation ('explanation'): A step-by-step solution showing why the correct choice is right and where common missteps occur.
9. Mistake Type ('mistakeTypeHint'): One of 'Careless Error', 'Concept Gap', 'Misread Question', 'Time Pressure', 'Calculation Error', or 'Formula Amnesia'.
10. Difficulty ('difficulty'): 'Easy', 'Medium', or 'Hard'.

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
              description: "Must be 'Math' or 'Reading & Writing'",
            },
            subTopic: {
              type: Type.STRING,
              description: "The specific SAT sub-topic name",
            },
            questionText: {
              type: Type.STRING,
              description: "The full question text and passage extracted from screenshots",
            },
            answerChoices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "Option letter like A, B, C, D" },
                  text: { type: Type.STRING, description: "Text content of the choice option" },
                },
                required: ['label', 'text'],
              },
            },
            correctAnswer: {
              type: Type.STRING,
              description: "The correct option letter or numeric value",
            },
            aiTakeaway: {
              type: Type.STRING,
              description: "A 2-sentence key takeaway or active recall memory tip",
            },
            explanation: {
              type: Type.STRING,
              description: "Step-by-step explanation of the solution",
            },
            graphData: {
              type: Type.OBJECT,
              properties: {
                hasGraph: { type: Type.BOOLEAN, description: "True if graph, chart, table, or diagram is present" },
                graphType: {
                  type: Type.STRING,
                  description: "linear, quadratic, scatterplot, barchart, table, geometry, diagram, or other",
                },
                title: { type: Type.STRING, description: "Title of graph or table" },
                xAxisLabel: { type: Type.STRING, description: "Label of horizontal axis" },
                yAxisLabel: { type: Type.STRING, description: "Label of vertical axis" },
                equation: { type: Type.STRING, description: "Mathematical equation of the function shown e.g. y = -0.75x + 6" },
                points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      label: { type: Type.STRING },
                    },
                    required: ['x', 'y'],
                  },
                },
                tableData: {
                  type: Type.OBJECT,
                  properties: {
                    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rows: {
                      type: Type.ARRAY,
                      items: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                  },
                },
                description: { type: Type.STRING, description: "Detailed description of visual graph or diagram" },
              },
            },
            mistakeTypeHint: {
              type: Type.STRING,
              description: "Suggested mistake category",
            },
            difficulty: {
              type: Type.STRING,
              description: "Easy, Medium, or Hard",
            },
          },
          required: ['subject', 'subTopic', 'questionText', 'correctAnswer', 'aiTakeaway', 'explanation'],
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
