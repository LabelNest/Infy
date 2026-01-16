
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from "@google/genai"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { raw_lead_id } = req.body
  if (!raw_lead_id) {
    return res.status(400).json({ error: 'Missing raw_lead_id' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { data: lead, error: rawError } = await supabase
      .from('infy_raw_leads')
      .select('*')
      .eq('id', raw_lead_id)
      .single()

    if (rawError || !lead) throw new Error('Infy raw lead not found')

    const serpQuery = `${lead.first_name} ${lead.last_name} ${lead.firm_name}`
    const serpRes = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(serpQuery)}&api_key=${process.env.SERP_API_KEY}`
    )

    const serpData = await serpRes.json()
    const organic = serpData.organic_results || []

    const linkedinUrl = organic.find(r => r.link?.includes("linkedin.com"))?.link || null
    const serpSnippets = organic.slice(0, 6).map(r => r.snippet).join("\n")
    const linkedInTitle = organic.find(r => r.link?.includes("linkedin.com"))?.title || ""

    const [jobLevels, functions, industries] = await Promise.all([
      supabase.from('infy_job_levels').select('*'),
      supabase.from('infy_function_taxonomy').select('*'),
      supabase.from('infy_industries').select('*')
    ])

    const systemInstruction = `
You are the Institutional Identity Resolution Engine for the Infy Intelligence Vault.
Your task is to generate the "standard_title".

EVIDENCE HIERARCHY:
1) LinkedIn Title (Highest Trust)
2) Company Website or Bio Snippets
3) Declared Title (User Input - Lowest Trust)

RULES:
- Expand ALL abbreviations (VP -> Vice President, Sr -> Senior, GTM -> Go To Market, etc.)
- Use COMMAS ONLY for punctuation. No hyphens, ampersands, or slashes.
- Order: Seniority, Department, Location.
- Capitalize Every Word.

TABLES FOR CLASSIFICATION:
Job Levels: ${JSON.stringify(jobLevels.data)}
Functions: ${JSON.stringify(functions.data)}
Industries: ${JSON.stringify(industries.data)}

OUTPUT JSON ONLY:
{
  "standard_title": { "value": "...", "confidence": 0-100 },
  "salutation": { "value": "Mr|Mrs|null", "confidence": 0-100 },
  "job_level": { "job_level_id": "...", "confidence": 0-100 },
  "function": { "function_taxonomy_id": "...", "confidence": 0-100 },
  "industry": { "industry_id": "...", "confidence": 0-100 },
  "intent_signal": { "value": "Low|Medium|High", "confidence": 0-100 }
}
`

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
Declared Title: ${lead.declared_title}
LinkedIn Title (SERP): ${linkedInTitle}
LinkedIn URL: ${linkedinUrl || "None"}
Evidence Snippets:
${serpSnippets}
`,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    })

    const intel = JSON.parse(response.text || '{}')

    const enrichedRecord = {
      raw_lead_id: lead.id,
      job_id: lead.job_id,
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      firm_name: lead.firm_name,
      standard_title: intel.standard_title?.value || null,
      salutation: intel.salutation?.value || null,
      job_level_id: intel.job_level?.job_level_id,
      function_taxonomy_id: intel.function?.function_taxonomy_id,
      industry_id: intel.industry?.industry_id,
      linkedin_url: linkedinUrl,
      intent_signal: intel.intent_signal?.value || 'Low',
      intent_score: intel.intent_signal?.confidence || 0,
      tenant_id: lead.tenant_id,
      project_id: lead.project_id,
      resolution_status: 'classified',
      raw_evidence_json: {
        serp: organic,
        ai: intel,
        resolution_path: "LinkedIn > Snippet > Declared"
      }
    }

    await supabase
      .from('infy_enriched_leads')
      .upsert(enrichedRecord, { onConflict: 'raw_lead_id' })

    await supabase
      .from('infy_raw_leads')
      .update({ enrichment_status: 'completed' })
      .eq('id', lead.id)

    return res.json({ status: 'ok', raw_lead_id: lead.id })

  } catch (err) {
    console.error("INFY PIPELINE ERROR:", err)
    return res.status(500).json({ status: 'error', message: err.message })
  }
}