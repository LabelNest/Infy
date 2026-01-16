
import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES } from "../constants";
import { EnrichedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Stage 2: SERP PROCESSING
 * Uses Google Search to find professional evidence.
 */
export const performDiscovery = async (firstName: string, lastName: string, firmName: string) => {
  const query = `site:linkedin.com/in "${firstName} ${lastName}" "${firmName}" OR "${firstName} ${lastName}" corporate bio official ${firmName}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Discovery request for: ${firstName} ${lastName} at ${firmName}. Find LinkedIn profile and professional snippets.`,
    config: {
      systemInstruction: "You are a professional discovery engine. Extract LinkedIn URLs and corporate bio snippets. Return as JSON.",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });

  try {
    const text = response.text || "{}";
    // We also want to capture the grounding metadata specifically
    const results = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return {
      query,
      results,
      raw_output: text
    };
  } catch (e) {
    throw new Error("SERP_DISCOVERY_FAILED");
  }
};

/**
 * Stage 3: AI RESOLUTION
 * Maps raw evidence to standardized taxonomies.
 */
export const resolveIdentityRefinery = async (
  declaredTitle: string,
  serpData: any,
  rawLeadId: string,
  leadInfo: { email: string; firstName: string; lastName: string; firmName: string; website?: string }
): Promise<EnrichedData> => {
  const linkedinUrl = serpData.raw_output?.includes('linkedin.com/in/') 
    ? serpData.raw_output.match(/https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/)?.[0] || null
    : null;

  const resolutionPrompt = `
USER INPUT:
Declared Title: ${declaredTitle}
SERP Snippets:
${JSON.stringify(serpData.results)}
LinkedIn URL:
${linkedinUrl}

TAXONOMIES PROVIDED:
- INFY_JOB_LEVELS: ${JSON.stringify(INFY_JOB_LEVELS)}
- INFY_FUNCTION_TAXONOMY: ${JSON.stringify(INFY_FUNCTION_TAXONOMY)}
- INFY_INDUSTRIES: ${JSON.stringify(INFY_INDUSTRIES)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are an institutional identity resolution engine. You MUST map the person to the closest matching taxonomy values. You MUST NOT invent values. You MUST return confidence scores. Map job_level to the numeric part of the ID (e.g., L1 -> 1).`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: { type: Type.STRING },
          job_level: { type: Type.INTEGER, description: "Map L1 to 1, L2 to 2, etc." },
          job_role: { type: Type.STRING },
          function: {
            type: Type.OBJECT,
            properties: {
              f0: { type: Type.STRING },
              f1: { type: Type.STRING },
              f2: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          },
          industry: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          },
          vertical: { type: Type.STRING },
          intent_signal: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING, description: "Low, Medium, or High" },
              confidence: { type: Type.NUMBER }
            }
          }
        },
        required: ["standard_title", "job_level", "function", "industry", "intent_signal"]
      }
    }
  });

  const resolution = JSON.parse(response.text || "{}");
  
  // Final Formatting for infy_export_view
  const jobId = `INFY-REQ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();

  return {
    job_id: jobId,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    standard_title: resolution.standard_title || null,
    job_level: resolution.job_level || null,
    job_role: resolution.job_role || null,
    f0: resolution.function?.f0 || null,
    f1: resolution.function?.f1 || null,
    f2: resolution.function?.f2 || null,
    vertical: resolution.vertical || null,
    industry: resolution.industry?.value || null,
    city: null,
    state: null,
    zip: null,
    country: null,
    region: null,
    phone: null,
    linkedin_url: linkedinUrl,
    revenue: null,
    intent_score: resolution.intent_signal?.confidence || 0,
    intent_signal: resolution.intent_signal?.value || "Low",
    is_verified: (resolution.intent_signal?.confidence || 0) > 70,
    tenant_id: "INSTITUTIONAL-DEFAULT",
    project_id: "REFINERY-MAIN",
    resolution_status: "completed",
    resolution_error: null,
    last_synced_at: now,
    created_at: now,
    raw_evidence_json: {
      serp_query: serpData.query,
      serp_results: serpData.results,
      ai_output: resolution
    }
  };
};

export const resolveCountryFromState = async (stateInput: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Country for ${stateInput}? Output JSON: {"country": ""}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '{"country": "Unknown"}');
};
