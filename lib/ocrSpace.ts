/**
 * OCR.space High-Speed OCR Client
 * Uses the free/configured OCR.space API key to extract raw text quickly from SAT screenshots.
 */

export interface OcrSpaceResult {
  parsedText: string;
  isSuccess: boolean;
  errorMessage?: string;
  processingTimeMs?: number;
}

export async function performOcrSpace(
  base64Data: string,
  mimeType: string = 'image/png',
  apiKey?: string
): Promise<OcrSpaceResult> {
  const key = apiKey || process.env.OCR_SPACE_API_KEY || 'K89945834288957';

  try {
    const formData = new FormData();
    formData.append('apikey', key);
    // OCR.space accepts full data URI string
    const dataUri = base64Data.startsWith('data:')
      ? base64Data
      : `data:${mimeType};base64,${base64Data}`;
    formData.append('base64Image', dataUri);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is optimized for reading/math test screenshots

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(9000), // 9s timeout for rapid fallback
    });

    if (!res.ok) {
      return {
        parsedText: '',
        isSuccess: false,
        errorMessage: `OCR.space returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();

    if (data.IsErroredOnProcessing) {
      const errMsg =
        data.ErrorMessage?.[0] || data.ErrorDetails || 'OCR.space processing error';
      return {
        parsedText: '',
        isSuccess: false,
        errorMessage: errMsg,
      };
    }

    const parsedResults = data.ParsedResults || [];
    const textPieces = parsedResults
      .map((r: any) => r.ParsedText || '')
      .filter((t: string) => t.trim().length > 0);

    const combinedText = textPieces.join('\n\n').trim();

    return {
      parsedText: combinedText,
      isSuccess: true,
      processingTimeMs: Number(data.ProcessingTimeInMilliseconds) || undefined,
    };
  } catch (err: any) {
    console.warn('OCR.space call failed or timed out:', err?.message || err);
    return {
      parsedText: '',
      isSuccess: false,
      errorMessage: err?.message || 'OCR.space request timeout or network error',
    };
  }
}
