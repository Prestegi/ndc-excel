import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedPersonSection {
  name: string;
  membershipNo: string;
  ward: string;
  pollingUnit: string;
  phoneNo: string;
  votersCardNo: string;
  state: string;
  lga: string;
  isCollationAgent: boolean;
  collationAgentRole: string;
  hasPassportPhoto: boolean;
  passportBox: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  } | null;
  sectionBox: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  flags: string[];
}

export interface ExtractionResult {
  pageNumber: number;
  sections: ExtractedPersonSection[];
  rawTextSummary?: string;
  modelUsed?: string;
}

export async function extractFormWithGemini(
  base64Data: string,
  mimeType: string = "image/jpeg",
  pageNumber: number = 1
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please verify your secrets configuration."
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const prompt = `You are a high-precision document extraction engine for the Ghanaian National Democratic Congress (NDC) Agent Data Collection Form.
This is an authentic scanned page containing handwritten entries.

Analyze the image carefully from top to bottom:
1. Locate EVERY distinct candidate/agent section on the sheet (typically 3 stacked horizontal rectangular sections, but examine the entire page to detect all sections).
2. For EACH separate section:
   - Determine its outer bounding box: sectionBox (ymin, xmin, ymax, xmax in 0-1000 scale).
   - Read the fields belonging STRICTLY to this person. NEVER mix details between sections.
   - Name: Full name in the exact written sequence (First, Middle, Surname). Read actual handwriting carefully.
   - Membership Card Number: Extract the card number digits as text. Preserve leading zeros (e.g., 020491823).
   - Ward: The ward name or number written in this section.
   - Polling Unit: The polling unit code and/or location name. Preserve leading zeros.
   - Phone Number: Extract the phone number as text. Must preserve leading zeros (e.g. starting with 024, 050, 020, 027, 054, etc.).
   - Voter's Card Number: Complete voter identification card number as text.
   - State/Region: Extract region (e.g., Greater Accra, Ashanti, etc.) if indicated.
   - LGA/Constituency: Extract constituency/district if indicated.
   - Collation Agent Checkbox: true if the "Collation Agent" box is checked or ticked, false if "Polling Station Agent" or unchecked.
   - Collation Agent Role: Title or role specified (e.g., "Polling Station Agent", "Constituency Collation Agent").

3. PASSPORT PHOTOGRAPH DETECTION & CROPPING (CRITICAL):
   - In each section, examine the passport photo box (usually located on the right side).
   - Is there an actual, real physical human portrait photograph affixed/pasted/stapled?
   - If YES:
     - set hasPassportPhoto = true.
     - passportBox: provide tight bounding box [ymin, xmin, ymax, xmax] of the PHOTOGRAPH ITSELF, NOT the surrounding table borders, NOT the "AFFIX PASSPORT HERE" label, and NOT adjacent text.
   - If NO:
     - The passport box is blank, empty white space, or only contains printed helper text ("Affix Passport Here") without a real photo.
     - set hasPassportPhoto = false.
     - set passportBox = null.
     - add 'missing_photo' to flags.

4. ACCURACY & HANDWRITING DISCIPLINE:
   - If handwriting is ambiguous or smudged, do NOT hallucinate or guess. Transcribe best-effort and add 'unclear_handwriting' to flags.
   - If a field is blank on the paper, output an empty string "" and flag it (e.g., 'missing_phone', 'missing_voters_card').
   - Output must be strict JSON matching the schema.`;

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");

  // Model cascade: try gemini-3.8-flash, fall back to gemini-3.5-flash if 503 (high demand)
  const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.7-flash"];
  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sections: {
                type: Type.ARRAY,
                description: "Array of extracted agent sections in top-to-bottom order.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    membershipNo: { type: Type.STRING },
                    ward: { type: Type.STRING },
                    pollingUnit: { type: Type.STRING },
                    phoneNo: { type: Type.STRING },
                    votersCardNo: { type: Type.STRING },
                    state: { type: Type.STRING },
                    lga: { type: Type.STRING },
                    isCollationAgent: { type: Type.BOOLEAN },
                    collationAgentRole: { type: Type.STRING },
                    hasPassportPhoto: { type: Type.BOOLEAN },
                    passportBox: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.INTEGER },
                        xmin: { type: Type.INTEGER },
                        ymax: { type: Type.INTEGER },
                        xmax: { type: Type.INTEGER },
                      },
                    },
                    sectionBox: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.INTEGER },
                        xmin: { type: Type.INTEGER },
                        ymax: { type: Type.INTEGER },
                        xmax: { type: Type.INTEGER },
                      },
                      required: ["ymin", "xmin", "ymax", "xmax"],
                    },
                    flags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    "name",
                    "membershipNo",
                    "ward",
                    "pollingUnit",
                    "phoneNo",
                    "votersCardNo",
                    "hasPassportPhoto",
                    "sectionBox",
                    "flags",
                  ],
                },
              },
            },
            required: ["sections"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error(`Empty response returned from model ${modelName}`);
      }

      const parsed = JSON.parse(text) as { sections: ExtractedPersonSection[] };

      // Validate and clean up sections
      const cleanedSections = (parsed.sections || []).map((sec) => {
        // Enforce null passportBox if photo is missing
        if (!sec.hasPassportPhoto || !sec.passportBox) {
          sec.hasPassportPhoto = false;
          sec.passportBox = null;
        } else {
          // Constrain coordinates to valid 0-1000 range
          sec.passportBox = {
            ymin: Math.max(0, Math.min(1000, Number(sec.passportBox.ymin) || 0)),
            xmin: Math.max(0, Math.min(1000, Number(sec.passportBox.xmin) || 0)),
            ymax: Math.max(0, Math.min(1000, Number(sec.passportBox.ymax) || 1000)),
            xmax: Math.max(0, Math.min(1000, Number(sec.passportBox.xmax) || 1000)),
          };
        }

        // Section box bounds
        sec.sectionBox = {
          ymin: Math.max(0, Math.min(1000, Number(sec.sectionBox?.ymin) || 0)),
          xmin: Math.max(0, Math.min(1000, Number(sec.sectionBox?.xmin) || 0)),
          ymax: Math.max(0, Math.min(1000, Number(sec.sectionBox?.ymax) || 1000)),
          xmax: Math.max(0, Math.min(1000, Number(sec.sectionBox?.xmax) || 1000)),
        };

        return sec;
      });

      return {
        pageNumber,
        sections: cleanedSections,
        modelUsed: modelName,
      };
    } catch (err: unknown) {
      console.warn(`Model ${modelName} failed, evaluating next candidate:`, err);
      lastError = err;
      // If error is not a 503 or transient error, retry or continue to next model
    }
  }

  // If all models failed, THROW real error - NEVER return mock data
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`OCR Extraction service error: ${errMsg}`);
}
