const PlateFormatValidator = require('./PlateFormatValidator');

class LicensePlateAgentService {
    /**
     * Analyze image and OCR results using Gemini API.
     * @param {string} base64Image 
     * @param {Object} ocrResult 
     */
    static async analyze(base64Image, ocrResult) {
        const apiKey = process.env.PLATE_AI_API_KEY;

        if (!apiKey) {
            // Mock mode for local testing is ONLY allowed if explicitly enabled via environment variable
            if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_AI === 'true') {
                console.log("[LicensePlateAgentService] No PLATE_AI_API_KEY provided. Using mock AI (Test Mode).");
                return this.mockAnalyze(base64Image, ocrResult);
            }
            console.log("[LicensePlateAgentService] No PLATE_AI_API_KEY provided. Using deterministic fallback.");
            return this.deterministicFallback(ocrResult);
        }

        try {
            // Using Google Gemini API (REST)
            // https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
            
            const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

            // Strict prompt enforcing IDENTITY, SCOPE, and OUTPUT_SCHEMA
            const systemInstruction = `
You are the START2WAY License Plate Recognition Agent.
Your exclusive purpose is to extract, normalize and classify vehicle registration plate candidates from supplied plate images and OCR data.
You do not identify vehicle owners, modify databases, or verify legal roadworthiness.
You must output ONLY valid JSON matching this schema:
{
  "ai_candidate_raw": "string",
  "ai_candidate_normalized": "string",
  "ai_country_code": "string (e.g., FR, DE, BE) or COUNTRY_AMBIGUOUS",
  "ai_country_confidence": number,
  "format_type": "CURRENT_FORMAT | LEGACY_VALID_FORMAT | UNKNOWN_FORMAT | INVALID_FORMAT",
  "format_match": boolean,
  "ambiguities": ["string"],
  "confidence": number,
  "requires_user_confirmation": true,
  "reason": "string"
}
Compare the OCR result (if provided) with your visual analysis. 
If they disagree, flag ambiguities. Normalization removes spaces and uses dashes for FR (e.g. AB-123-CD).
`;

            const promptText = `
OCR Result: ${ocrResult ? JSON.stringify(ocrResult) : 'None'}
Please analyze the image and the OCR result, and return the structured JSON output.
`;

            const payload = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{
                    parts: [
                        { text: promptText },
                        { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            const aiText = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(aiText);
            
            // Overwrite confirmation requirement to strictly follow V1 safety policy
            parsed.requires_user_confirmation = true;

            // Deterministic validation check
            const validation = PlateFormatValidator.validate(parsed.ai_country_code, parsed.ai_candidate_normalized);
            parsed.format_type = validation.format_type;
            parsed.format_match = validation.match;
            parsed.ai_candidate_normalized = validation.normalized;

            return parsed;
        } catch (error) {
            console.error("[LicensePlateAgentService] AI Error:", error);
            // Fallback to deterministic OCR processing
            return this.deterministicFallback(ocrResult);
        }
    }

    static mockAnalyze(base64Image, ocrResult) {
        // Mock responses for strict testing scenarios
        let candidate = ocrResult ? ocrResult.raw_text : "AB-123-CD";
        let country = "FR";
        let normalized = "AB-123-CD";
        
        if (base64Image.includes('mock_foreign')) {
            country = "DE";
            normalized = "M-AB 1234";
        }
        else if (base64Image.includes('mock_ambiguous')) {
            country = "COUNTRY_AMBIGUOUS";
            normalized = "AB1234";
        }
        else if (base64Image.includes('mock_disagree')) {
            // OCR is AB-123-C0, AI sees AB-123-CD
            normalized = "AB-123-CD"; 
        }
        else if (base64Image.includes('mock_unreadable')) {
            return {
                ai_candidate_raw: null,
                ai_candidate_normalized: null,
                ai_country_code: null,
                ai_country_confidence: 0,
                format_type: 'INVALID_FORMAT',
                format_match: false,
                ambiguities: [],
                confidence: 0,
                requires_user_confirmation: true,
                reason: "UNREADABLE"
            };
        }
        else if (base64Image.includes('mock_duplicate')) {
            normalized = "AB-123-CD";
        }

        const validation = PlateFormatValidator.validate(country, normalized);

        return {
            ai_candidate_raw: candidate,
            ai_candidate_normalized: validation.normalized,
            ai_country_code: country,
            ai_country_confidence: 0.95,
            format_type: validation.format_type,
            format_match: validation.match,
            ambiguities: base64Image.includes('mock_disagree') ? ["0/O conflict"] : [],
            confidence: 0.95,
            requires_user_confirmation: true,
            reason: "Mock AI fallback"
        };
    }

    static deterministicFallback(ocrResult) {
        if (!ocrResult || !ocrResult.raw_text) {
            return { requires_user_confirmation: true, error: "AI and OCR failed", confidence: 0 };
        }
        
        // Very basic fallback if AI is down
        const raw = ocrResult.raw_text.trim();
        // Guess country if F is present at the end
        let country = "UNKNOWN";
        let norm = raw;
        
        if (raw.endsWith(" F")) {
            country = "FR";
            norm = raw.replace(" F", "");
        }
        
        const validation = PlateFormatValidator.validate(country, norm);

        return {
            ai_candidate_raw: raw,
            ai_candidate_normalized: validation.normalized,
            ai_country_code: country === "UNKNOWN" ? "COUNTRY_AMBIGUOUS" : country,
            ai_country_confidence: 0.5,
            format_type: validation.format_type,
            format_match: validation.match,
            ambiguities: [],
            confidence: ocrResult.confidence || 0.5,
            requires_user_confirmation: true,
            reason: "Deterministic fallback (AI unavailable)"
        };
    }
}

module.exports = LicensePlateAgentService;
