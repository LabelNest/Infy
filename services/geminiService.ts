import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES, COUNTRY_REGION_MAPPING } from "../constants";
import { InfyEnrichedData } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const fetchEvidence = async (leadInfo: { firstName: string; lastName: string; firmName: string; website?: string }) => {
  const ai = getAiClient();
  const query = `professional profile for "${leadInfo.firstName} ${leadInfo.lastName}" at "${leadInfo.firmName}" AND "${leadInfo.firmName}" corporate headquarters address city state zip`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find professional details for ${leadInfo.firstName} ${leadInfo.lastName} at ${leadInfo.firmName} and their corporate HQ address.`,
    config: {
      systemInstruction: "Extract professional location data. Use Company HQ if individual office is missing. City, State, and Zip are mandatory. ZIP MUST be the real geographic code matching the City/State. Placeholders like 00000 or 99999 are strictly forbidden.",
      tools: [{ googleSearch: {} }],
    }
  });

  return {
    query,
    results: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    raw_output: response.text || "{}"
  };
};

export const resolveIdentityRefinery = async (
  declaredTitle: string,
  rawLeadId: string,
  leadInfo: { email: string; firstName: string; lastName: string; firmName: string; website?: string }
): Promise<InfyEnrichedData> => {
  const ai = getAiClient();
  const evidenceData = await fetchEvidence(leadInfo);

  const resolutionPrompt = `
LEAD: ${leadInfo.firstName} ${leadInfo.lastName} @ ${leadInfo.firmName} (${declaredTitle})
EVIDENCE: ${JSON.stringify(evidenceData.results)}
FUNCTION TAXONOMY: ${JSON.stringify(INFY_FUNCTION_TAXONOMY.map(t => ({ id: t.function_taxonomy_id, f0: t.f0, f1: t.f1 })))}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are a Deterministic Resolver for LabelNest Refinery. Output JSON ONLY.
1. Return exactly one function_taxonomy_id from the provided list.
2. Return a job_level_slug: "L1-FOUNDER", "L2-PRESIDENT", "L3-VP", or "L4-MANAGER".
3. ZIP code MUST be verified and MUST correctly match the City and State. 
4. If the specific work location ZIP is unknown, you MUST use the Company's HQ ZIP. 
5. CRITICAL: "00000" and "99999" are strictly forbidden. If you cannot find any valid ZIP through search or HQ fallback, return an empty string for the zip field.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: { type: Type.STRING },
          job_level_slug: { type: Type.STRING, enum: ["L1-FOUNDER", "L2-PRESIDENT", "L3-VP", "L4-MANAGER"] },
          function_taxonomy_id: { type: Type.STRING },
          industry_id: { type: Type.STRING },
          location: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              state: { type: Type.STRING },
              country: { type: Type.STRING },
              zip: { type: Type.STRING }
            },
            required: ["city", "state", "country", "zip"]
          },
          linkedin_url: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["standard_title", "job_level_slug", "function_taxonomy_id", "industry_id", "location", "confidence", "linkedin_url"]
      }
    }
  });

  const intel = JSON.parse(response.text || "{}");
  
  // MAP SLUGS/IDs to DATABASE UUIDs
  const levelMatch = INFY_JOB_LEVELS.find(l => l.slug === intel.job_level_slug);
  const funcMatch = INFY_FUNCTION_TAXONOMY.find(f => f.function_taxonomy_id === intel.function_taxonomy_id);
  const indMatch = INFY_INDUSTRIES.find(i => i.industry_id === intel.industry_id);
  
  const country = intel.location.country || "United States";
  const region = COUNTRY_REGION_MAPPING[country] || "Global";

  // Final sanitization of ZIP: Placeholder becomes empty string, never null
  const rawZip = intel.location.zip;
  const sanitizedZip = (rawZip === "00000" || rawZip === "99999" || !rawZip) 
    ? "" 
    : String(rawZip).trim();

  return {
    job_id: `INFY-DET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    website: leadInfo.website || "",
    standard_title: intel.standard_title || "",
    salutation: "",
    job_level: levelMatch?.job_level_numeric || 4,
    job_level_id: levelMatch?.job_level_id || "",
    job_role: funcMatch?.job_role || "",
    job_role_id: funcMatch?.job_role_id || "",
    function_taxonomy_id: intel.function_taxonomy_id || "",
    f0: funcMatch?.f0 || "",
    f1: funcMatch?.f1 || "",
    f2: funcMatch?.f2 || "",
    industry: indMatch?.industry_name || "",
    industry_id: intel.industry_id || "",
    vertical: indMatch?.vertical_code || "",
    vertical_id: indMatch?.vertical_id || "",
    city: intel.location.city || "",
    state: intel.location.state || "",
    zip: sanitizedZip,
    country: country,
    region: region,
    phone: "",
    linkedin_url: intel.linkedin_url || "",
    intent_score: intel.confidence || 0,
    intent_signal: intel.confidence > 70 ? "High" : intel.confidence > 40 ? "Medium" : "Low",
    is_verified: intel.confidence > 85,
    tenant_id: "INSTITUTIONAL-DEFAULT",
    project_id: "REFINERY-MAIN",
    resolution_status: "classified",
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    raw_evidence_json: {
      serp_query: evidenceData.query,
      serp_results: evidenceData.results,
      ai_output: intel
    }
  };
};

export const resolveCountryFromState = async (stateInput: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Map "${stateInput}" to Country and Region.`,
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