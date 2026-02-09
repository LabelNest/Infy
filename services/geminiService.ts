
import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES, COUNTRY_REGION_MAPPING } from "../constants";
import { InfyEnrichedData } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const fetchEvidence = async (leadInfo: { firstName: string; lastName: string; firmName: string; website?: string }) => {
  const ai = getAiClient();
  const query = `site:linkedin.com/in/ "${leadInfo.firstName} ${leadInfo.lastName}" "${leadInfo.firmName}" professional bio`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find the LinkedIn URL and bio for ${leadInfo.firstName} ${leadInfo.lastName} at ${leadInfo.firmName}.`,
    config: {
      systemInstruction: "Research agent. Identify EXACT LinkedIn URL and professional background. Ground search results.",
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

  // Hardcoded ID rules for the prompt
  const levelTable = INFY_JOB_LEVELS.map(l => ({ id: l.job_level_id, label: l.label, numeric: l.job_level_numeric }));
  const taxonomyTable = INFY_FUNCTION_TAXONOMY.map(t => ({ id: t.function_taxonomy_id, f0: t.f0, f1: t.f1, role: t.job_role }));
  const industryTable = INFY_INDUSTRIES.map(i => ({ id: i.industry_id, name: i.industry_name }));

  const resolutionPrompt = `
ENRICHMENT TASK:
Identity: ${leadInfo.firstName} ${leadInfo.lastName}
Firm: ${leadInfo.firmName}
Stated Title: ${declaredTitle}

EVIDENCE FROM WEB: ${JSON.stringify(evidenceData.results)}

STRICT MAPPING TABLES (YOU MUST ONLY USE IDs FROM THESE TABLES):
Levels (Hard Mappings):
- VP / Vice President / President / EVP / SVP: MUST USE ID "8c7d6e5a-4b3c-2d1a-9e8f-7g6h5i4j3k2l" (Level 2)
- Executive Director / Director: MUST USE ID "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6" (Level 3)
Full Level Table: ${JSON.stringify(levelTable)}

Function Taxonomy Table: ${JSON.stringify(taxonomyTable)}
Industry Table: ${JSON.stringify(industryTable)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are a Deterministic Data Resolver.
STRICT INSTRUCTIONS:
1. DO NOT create new job levels or IDs.
2. If the person is a Vice President (VP), EVP, or SVP, map to Level ID "8c7d6e5a-4b3c-2d1a-9e8f-7g6h5i4j3k2l" (Numeric 2).
3. If the person is an Executive Director or Director, map to Level ID "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6" (Numeric 3).
4. DO NOT map Marketing roles to Sales. Use the provided Marketing taxonomy IDs.
5. Extract the LinkedIn URL from the grounded evidence.
6. Resolve City, State, Country. ZIP must be valid (no 00000). Use Company HQ ZIP if specific location is unknown.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: { type: Type.STRING },
          job_level_id: { type: Type.STRING },
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
        required: ["standard_title", "job_level_id", "function_taxonomy_id", "industry_id", "location", "confidence", "linkedin_url", "bio_snippet", "job_description"]
      }
    }
  });

  const intel = JSON.parse(response.text || "{}");
  
  const levelMatch = INFY_JOB_LEVELS.find(l => l.job_level_id === intel.job_level_id);
  const funcMatch = INFY_FUNCTION_TAXONOMY.find(f => f.function_taxonomy_id === intel.function_taxonomy_id);
  const indMatch = INFY_INDUSTRIES.find(i => i.industry_id === intel.industry_id);
  
  const country = intel.location.country || "United States";
  const region = COUNTRY_REGION_MAPPING[country] || "Global";

  return {
    job_id: `INFY-DET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    website: leadInfo.website || "",
    standard_title: intel.standard_title || declaredTitle,
    salutation: "",
    job_level: levelMatch?.job_level_numeric || 4,
    job_level_id: intel.job_level_id,
    job_role: funcMatch?.job_role || "",
    job_role_id: funcMatch?.job_role_id || "",
    function_taxonomy_id: intel.function_taxonomy_id,
    f0: funcMatch?.f0 || "",
    f1: funcMatch?.f1 || "",
    f2: funcMatch?.f2 || "",
    industry: indMatch?.industry_name || "",
    industry_id: intel.industry_id,
    vertical: indMatch?.vertical_code || "",
    vertical_id: indMatch?.vertical_id || "",
    city: intel.location.city || "",
    state: intel.location.state || "",
    zip: intel.location.zip || "",
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
