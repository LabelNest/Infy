import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES, COUNTRY_REGION_MAPPING } from "../constants";
import { InfyEnrichedData } from "../types";

/**
 * Institutional Classification Engine
 * Initialized via Google GenAI SDK using process.env.API_KEY
 */
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Stage 2: ENHANCED DISCOVERY (Internal Helper)
 * Used by the refinery to gather grounding evidence.
 */
const fetchEvidence = async (leadInfo: { firstName: string; lastName: string; firmName: string; website?: string }) => {
  const ai = getAiClient();
  const query = `site:linkedin.com/in intitle:"${leadInfo.firstName} ${leadInfo.lastName}" "${leadInfo.firmName}"`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find the professional LinkedIn profile, bio snippets, and current job description for ${leadInfo.firstName} ${leadInfo.lastName} at ${leadInfo.firmName}. 
               Context Website: ${leadInfo.website || 'Not provided'}.`,
    config: {
      systemInstruction: "You are a specialized OSINT agent. Locate CURRENT employment evidence. Do not guess. Extract grounding chunks with high precision.",
      tools: [{ googleSearch: {} }],
    }
  });

  return {
    query,
    results: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    raw_output: response.text || "{}"
  };
};

/**
 * Stage 3: REFINERY ENGINE (Governed Identity Resolution)
 * Deterministic classifier that first gathers SERP evidence then applies strict taxonomy rules.
 */
export const resolveIdentityRefinery = async (
  declaredTitle: string,
  rawLeadId: string,
  leadInfo: { email: string; firstName: string; lastName: string; firmName: string; website?: string }
): Promise<InfyEnrichedData> => {
  const ai = getAiClient();

  // PASS 1: INTERNAL SERP DISCOVERY
  const evidenceData = await fetchEvidence(leadInfo);

  // PASS 2: DETERMINISTIC CLASSIFICATION
  const resolutionPrompt = `
LEAD PROFILE:
- Name: ${leadInfo.firstName} ${leadInfo.lastName}
- Target Firm: ${leadInfo.firmName}
- Declared Title: ${declaredTitle}

EVIDENCE FROM SEARCH:
${JSON.stringify(evidenceData.results)}

CONTROLLED TABLES (MANDATORY SELECTION):
- Job Levels: ${JSON.stringify(INFY_JOB_LEVELS)}
- Function Taxonomy: ${JSON.stringify(INFY_FUNCTION_TAXONOMY)}
- Industry Vertical: ${JSON.stringify(INFY_INDUSTRIES)}
- Country-Region Map: ${JSON.stringify(COUNTRY_REGION_MAPPING)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are an Institutional Classification Engine operating under STRICT GOVERNANCE.
You are a deterministic classifier. NO free text inference.

LINKEDIN VALIDATION:
- Verify profile evidence matches CURRENT employment at ${leadInfo.firmName}.
- If the URL is for a former employee or different person, set linkedin_url to null.

FUNCTION MAPPING RULES:
1. You MUST select ONE row from infy_function_taxonomy.
2. f0, f1, f2 MUST come from the SAME ROW. You MUST NOT mix values across rows.
3. BUSINESS RULE: If job_role is "Business", f2 MUST be NULL unless f0 is "Marketing".
4. SALES RULE: Use only f1 values explicitly present in the table.

STANDARD TITLE RULES:
- Format: [Seniority], [Function]. Example: "Manager, Service Delivery".
- Expand abbreviations: VP -> Vice President, Sr -> Senior, GTM -> Go To Market.
- Capitalize every word. Use COMMAS ONLY.

GEOGRAPHY RULES:
- City, State, Country must match evidence.
- REGION: Map Country strictly using the Country-Region Map.
- ZIP: MUST NOT BE NULL. Resolve the most likely ZIP for the City/State/Country combination.

OUTPUT JSON ONLY.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          linkedin_url: { type: Type.STRING },
          salutation: { type: Type.STRING },
          standard_title: { type: Type.STRING },
          job_level_id: { type: Type.STRING },
          function_taxonomy_id: { type: Type.STRING },
          industry_id: { type: Type.STRING },
          city: { type: Type.STRING },
          state: { type: Type.STRING },
          country: { type: Type.STRING },
          zip: { type: Type.STRING, description: 'Mandatory deterministic postal code.' },
          confidence: { type: Type.NUMBER },
          intent_signal: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
        },
        required: ["standard_title", "job_level_id", "function_taxonomy_id", "industry_id", "city", "state", "country", "zip"]
      }
    }
  });

  const res = JSON.parse(response.text || "{}");
  
  // Resolve mapping objects
  const levelMatch = INFY_JOB_LEVELS.find(l => l.job_level_id === res.job_level_id);
  const funcMatch = INFY_FUNCTION_TAXONOMY.find(f => f.function_taxonomy_id === res.function_taxonomy_id);
  const indMatch = INFY_INDUSTRIES.find(i => i.industry_id === res.industry_id);
  const region = COUNTRY_REGION_MAPPING[res.country] || "Global";

  const now = new Date().toISOString();

  return {
    job_id: `INFY-DET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    website: leadInfo.website || null,
    standard_title: res.standard_title,
    salutation: res.salutation || null,
    job_level: levelMatch?.job_level_numeric || 5,
    job_level_id: res.job_level_id,
    job_role: funcMatch?.job_role || null,
    job_role_id: funcMatch?.job_role_id || null,
    function_taxonomy_id: res.function_taxonomy_id,
    f0: funcMatch?.f0 || null,
    f1: funcMatch?.f1 || null,
    f2: funcMatch?.f2 || null,
    industry: indMatch?.industry_name || null,
    industry_id: res.industry_id,
    vertical: indMatch?.vertical_code || null,
    vertical_id: indMatch?.vertical_id || null,
    city: res.city,
    state: res.state,
    zip: res.zip, 
    country: res.country,
    region: region,
    phone: null,
    linkedin_url: res.linkedin_url || null,
    intent_score: res.confidence || 0,
    intent_signal: res.intent_signal || "Low",
    is_verified: (res.confidence || 0) > 85,
    tenant_id: "INSTITUTIONAL-DEFAULT",
    project_id: "REFINERY-MAIN",
    resolution_status: "classified",
    last_synced_at: now,
    created_at: now,
    raw_evidence_json: {
      serp_query: evidenceData.query,
      serp_results: evidenceData.results,
      ai_output: res,
      discovery_logic: "internal_serp_pass_v5"
    }
  };
};

/**
 * Tactical Mapping Engine (Helper)
 */
export const resolveCountryFromState = async (stateInput: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Map the administrative unit "${stateInput}" to its full Country and Region.`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          country: { type: Type.STRING },
          region: { type: Type.STRING }
        },
        required: ["country", "region"]
      }
    }
  });
  return JSON.parse(response.text || '{"country": "Unknown", "region": "Global"}');
};