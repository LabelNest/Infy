
import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES, COUNTRY_REGION_MAPPING } from "../constants";
import { InfyEnrichedData } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const fetchEvidence = async (leadInfo: { firstName: string; lastName: string; firmName: string; website?: string }) => {
  const ai = getAiClient();
  // Enhanced query to fetch bio snippets and job descriptions as per user flowchart
  const query = `"${leadInfo.firstName} ${leadInfo.lastName}" at "${leadInfo.firmName}" linkedin profile bio AND "${leadInfo.firmName}" job description for "${leadInfo.firstName}'s" current role AND corporate HQ address`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find the LinkedIn bio, job description, and HQ address for ${leadInfo.firstName} ${leadInfo.lastName} at ${leadInfo.firmName}.`,
    config: {
      systemInstruction: "Extract professional identity details. Prioritize LinkedIn snippets and official job descriptions. ZIP MUST be verified. '00000' is forbidden.",
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
      systemInstruction: `You are a Deterministic Resolver. Output JSON ONLY.
1. Map to exactly one function_taxonomy_id.
2. Determine job_level_slug: "L1-FOUNDER", "L2-PRESIDENT", "L3-VP", or "L4-MANAGER".
3. Extract bio_snippet (from LinkedIn/Bio results) and job_description (found role duties).
4. CRITICAL: ZIP MUST be real. If unknown, use Company HQ ZIP. "00000" and "99999" are forbidden (use empty string instead).`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: { type: Type.STRING },
          job_level_slug: { type: Type.STRING, enum: ["L1-FOUNDER", "L2-PRESIDENT", "L3-VP", "L4-MANAGER"] },
          function_taxonomy_id: { type: Type.STRING },
          industry_id: { type: Type.STRING },
          bio_snippet: { type: Type.STRING },
          job_description: { type: Type.STRING },
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
        required: ["standard_title", "job_level_slug", "function_taxonomy_id", "industry_id", "location", "confidence", "linkedin_url", "bio_snippet", "job_description"]
      }
    }
  });

  const intel = JSON.parse(response.text || "{}");
  
  const levelMatch = INFY_JOB_LEVELS.find(l => l.slug === intel.job_level_slug);
  const funcMatch = INFY_FUNCTION_TAXONOMY.find(f => f.function_taxonomy_id === intel.function_taxonomy_id);
  const indMatch = INFY_INDUSTRIES.find(i => i.industry_id === intel.industry_id);
  
  const country = intel.location.country || "United States";
  const region = COUNTRY_REGION_MAPPING[country] || "Global";

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
    bio_snippet: intel.bio_snippet || "",
    job_description: intel.job_description || "",
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
