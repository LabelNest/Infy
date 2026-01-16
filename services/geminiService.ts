import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES } from "../constants";
import { InfyEnrichedData } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === '') {
    throw new Error("CRITICAL: Gemini API_KEY is missing. Please set it in Vercel Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Stage 2: SERP PROCESSING
 */
export const performDiscovery = async (firstName: string, lastName: string, firmName: string) => {
  const ai = getAiClient();
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
 * Stage 3: AI RESOLUTION (GOVERNED ENGINE)
 */
export const resolveIdentityRefinery = async (
  declaredTitle: string,
  serpData: any,
  rawLeadId: string,
  leadInfo: { email: string; firstName: string; lastName: string; firmName: string; website?: string }
): Promise<InfyEnrichedData> => {
  const ai = getAiClient();
  const linkedinUrl = serpData.raw_output?.includes('linkedin.com/in/') 
    ? serpData.raw_output.match(/https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/)?.[0] || null
    : null;

  const resolutionPrompt = `
USER INPUT:
Declared Title: ${declaredTitle}
SERP Snippets: ${JSON.stringify(serpData.results)}
LinkedIn URL: ${linkedinUrl}
Firm Context: ${leadInfo.firmName}

TAXONOMIES (STRICT ENFORCEMENT):
1. Job Levels (1-4): ${JSON.stringify(INFY_JOB_LEVELS)}
2. Function Taxonomy (F0->F1->F2): ${JSON.stringify(INFY_FUNCTION_TAXONOMY)}
3. Industry & Vertical: ${JSON.stringify(INFY_INDUSTRIES)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are a GOVERNED Institutional Intelligence Resolution Engine. Act as the lead researcher at Infosys.
      
STRICT TAXONOMY RULES:
- FIELD: job_level (ENUM 1-4). 1=Founder/C-Level, 2=President/SVP, 3=VP/Director, 4=Manager/Head. Map EXACTLY based on standard_title. Cannot be null.
- FIELD: job_role & function (HIERARCHY). Must exist verbatim in INFY_FUNCTION_TAXONOMY. F0 must exist for F1 to exist. F1 must exist for F2 to exist.
- FIELD: industry & vertical. Must be direct matches from INFY_INDUSTRIES. dominant industry only. Never null.
- FIELD: geography (city, state, country). Full names only. No abbreviations (e.g., 'United States' not 'USA'). State must match country. City cannot be null.
- PROPERTY: standard_title. Expand all abbreviations (VP -> Vice President). Use COMMAS ONLY. No hyphens or slashes.

GOVERNANCE: If evidence is missing, use highest probability match from provided lists. NEVER invent new labels.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: { type: Type.STRING },
          job_level: { type: Type.INTEGER, description: "1 to 4 numeric value" },
          job_role: { type: Type.STRING },
          f0: { type: Type.STRING },
          f1: { type: Type.STRING },
          f2: { type: Type.STRING },
          industry: { type: Type.STRING },
          vertical: { type: Type.STRING },
          city: { type: Type.STRING },
          state: { type: Type.STRING },
          country: { type: Type.STRING },
          intent_signal: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          intent_confidence: { type: Type.NUMBER, description: "0-100" }
        },
        required: ["standard_title", "job_level", "f0", "industry", "vertical", "city", "state", "country"]
      }
    }
  });

  const res = JSON.parse(response.text || "{}");
  
  // Find taxonomy IDs for database consistency
  const industryMatch = INFY_INDUSTRIES.find(i => i.industry_name === res.industry);
  const functionMatch = INFY_FUNCTION_TAXONOMY.find(f => f.f0 === res.f0 && f.f1 === res.f1 && f.f2 === res.f2);

  const jobId = `INFY-REQ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();

  return {
    job_id: jobId,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    website: leadInfo.website || null,
    standard_title: res.standard_title,
    job_level: res.job_level,
    job_level_id: `L${res.job_level}`,
    job_role: res.job_role || functionMatch?.job_role || null,
    function_taxonomy_id: functionMatch?.function_taxonomy_id || null,
    f0: res.f0,
    f1: res.f1,
    f2: res.f2,
    industry: res.industry,
    industry_id: industryMatch?.industry_id || null,
    vertical: res.vertical || industryMatch?.vertical_code || null,
    city: res.city,
    state: res.state,
    country: res.country,
    zip: null,
    region: null,
    phone: null,
    linkedin_url: linkedinUrl,
    revenue: null,
    intent_score: res.intent_confidence || 0,
    intent_signal: res.intent_signal || "Low",
    is_verified: (res.intent_confidence || 0) > 75,
    tenant_id: "INSTITUTIONAL-DEFAULT",
    project_id: "REFINERY-MAIN",
    resolution_status: "completed",
    resolution_error: null,
    last_synced_at: now,
    created_at: now,
    raw_evidence_json: {
      serp_query: serpData.query,
      serp_results: serpData.results,
      ai_output: res
    }
  };
};

export const resolveCountryFromState = async (stateInput: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Map the administrative unit "${stateInput}" to its full country name. Output JSON only.`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          country: { type: Type.STRING },
          state_or_province: { type: Type.STRING }
        },
        required: ["country", "state_or_province"]
      }
    }
  });
  return JSON.parse(response.text || '{"country": "Unknown", "state_or_province": ""}');
};