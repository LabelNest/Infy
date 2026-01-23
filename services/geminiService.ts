import { GoogleGenAI, Type } from "@google/genai";
import { INFY_JOB_LEVELS, INFY_FUNCTION_TAXONOMY, INFY_INDUSTRIES, COUNTRY_REGION_MAPPING } from "../constants";
import { InfyEnrichedData } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Stage 2: ENHANCED DISCOVERY
 * Gathers grounding evidence from the web, explicitly looking for HQ if person location is missing.
 */
const fetchEvidence = async (leadInfo: { firstName: string; lastName: string; firmName: string; website?: string }) => {
  const ai = getAiClient();
  // Search for both person and company HQ for location fallback
  const query = `"${leadInfo.firstName} ${leadInfo.lastName}" at "${leadInfo.firmName}" location OR "${leadInfo.firmName}" headquarters address`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find the professional profile and location for ${leadInfo.firstName} ${leadInfo.lastName} at ${leadInfo.firmName}. 
               If the specific person's location is unavailable, find the official Headquarters address for ${leadInfo.firmName}.`,
    config: {
      systemInstruction: "You are a specialized OSINT agent. Locate CURRENT employment and location evidence. Do not return placeholders like '00000'. Search for HQ if person location is missing.",
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
 * Stage 3: REFINERY ENGINE (Institutional Classification)
 * Deterministic classifier following strict governance rules.
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

CONTROLLED TABLES:
- Job Levels (VALID IDS ONLY: L1-L4): ${JSON.stringify(INFY_JOB_LEVELS)}
- Function Taxonomy: ${JSON.stringify(INFY_FUNCTION_TAXONOMY)}
- Industries: ${JSON.stringify(INFY_INDUSTRIES)}
- Country-Region Map: ${JSON.stringify(COUNTRY_REGION_MAPPING)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: resolutionPrompt,
    config: {
      systemInstruction: `You are an Institutional Classification Engine.
STRICT GOVERNANCE:
1. Return ONLY IDs from the controlled tables. 
2. JOB LEVEL: Only L1, L2, L3, or L4 are permitted. Do not return L5.
3. LOCATION (MANDATORY): City and State MUST NOT BE NULL.
   - If the person's specific location is not found in evidence, you MUST use the Company Headquarters location found in the evidence.
4. ZIP CODE: MUST BE A VALID 5-9 DIGIT POSTAL CODE for the resolved city. Do not return '00000'.
5. FUNCTION MAPPING: Select exactly ONE row from taxonomy. f0, f1, f2 must be from the SAME ROW.
6. STANDARD TITLE: Expand all abbreviations (VP -> Vice President). Use COMMAS ONLY.

OUTPUT JSON ONLY.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          standard_title: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["value", "confidence"]
          },
          job_level: {
            type: Type.OBJECT,
            properties: {
              job_level_id: { type: Type.STRING, enum: ["L1-FOUNDER", "L2-PRESIDENT", "L3-VP", "L4-MANAGER"] },
              confidence: { type: Type.NUMBER }
            },
            required: ["job_level_id", "confidence"]
          },
          job_role: {
            type: Type.OBJECT,
            properties: {
              job_role_id: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER }
            },
            required: ["job_role_id", "confidence"]
          },
          function: {
            type: Type.OBJECT,
            properties: {
              function_taxonomy_id: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER }
            },
            required: ["function_taxonomy_id", "confidence"]
          },
          industry: {
            type: Type.OBJECT,
            properties: {
              industry_id: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER }
            },
            required: ["industry_id", "confidence"]
          },
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
          profile: {
            type: Type.OBJECT,
            properties: {
              linkedin_url: { type: Type.STRING, nullable: true },
              source: { type: Type.STRING, enum: ["serp", "none"] }
            },
            required: ["linkedin_url", "source"]
          },
          intent_signal: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              confidence: { type: Type.NUMBER }
            },
            required: ["value", "confidence"]
          }
        },
        required: ["standard_title", "job_level", "function", "industry", "location", "profile", "intent_signal"]
      }
    }
  });

  const intel = JSON.parse(response.text || "{}");
  
  // Strict resolution from tables based on IDs
  const levelMatch = INFY_JOB_LEVELS.find(l => l.job_level_id === intel.job_level.job_level_id);
  const funcMatch = INFY_FUNCTION_TAXONOMY.find(f => f.function_taxonomy_id === intel.function.function_taxonomy_id);
  const indMatch = INFY_INDUSTRIES.find(i => i.industry_id === intel.industry.industry_id);
  
  const resolvedCountry = intel.location.country || "United States";
  const region = COUNTRY_REGION_MAPPING[resolvedCountry] || "Global";

  const now = new Date().toISOString();

  return {
    job_id: `INFY-DET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    raw_lead_id: rawLeadId,
    email: leadInfo.email,
    first_name: leadInfo.firstName,
    last_name: leadInfo.lastName,
    firm_name: leadInfo.firmName,
    website: leadInfo.website || null,
    standard_title: intel.standard_title.value,
    salutation: null,
    job_level: levelMatch?.job_level_numeric || 4,
    job_level_id: intel.job_level.job_level_id,
    job_role: funcMatch?.job_role || null,
    job_role_id: funcMatch?.job_role_id || null,
    function_taxonomy_id: intel.function.function_taxonomy_id,
    f0: funcMatch?.f0 || null,
    f1: funcMatch?.f1 || null,
    f2: funcMatch?.f2 || null,
    industry: indMatch?.industry_name || null,
    industry_id: intel.industry.industry_id,
    vertical: indMatch?.vertical_code || null,
    vertical_id: indMatch?.vertical_id || null,
    city: intel.location.city,
    state: intel.location.state,
    zip: intel.location.zip || "Unknown", 
    country: resolvedCountry,
    region: region,
    phone: null,
    linkedin_url: intel.profile.linkedin_url,
    intent_score: intel.intent_signal.confidence,
    intent_signal: intel.intent_signal.value,
    is_verified: intel.intent_signal.confidence > 85,
    tenant_id: "INSTITUTIONAL-DEFAULT",
    project_id: "REFINERY-MAIN",
    resolution_status: "classified",
    last_synced_at: now,
    created_at: now,
    raw_evidence_json: {
      serp_query: evidenceData.query,
      serp_results: evidenceData.results,
      ai_output: intel,
      discovery_logic: "location_mandatory_v7"
    }
  };
};

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