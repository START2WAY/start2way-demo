class PlateOCRService {
    /**
     * @param {string} base64Image - the base64 encoded image (data URI or raw base64)
     * @returns {Promise<Object>} - { raw_text, confidence, error }
     */
    static async recognize(base64Image) {
        // Extract base64 part if it's a data URI
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const apiKey = process.env.PLATE_OCR_API_KEY;

        if (!apiKey) {
            // Mock mode for local testing is ONLY allowed if explicitly enabled via environment variable
            if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_OCR === 'true') {
                console.log("[PlateOCRService] No PLATE_OCR_API_KEY provided. Using mock OCR (Test Mode).");
                return this.mockRecognize(base64Image);
            }
            console.warn("[PlateOCRService] PLATE_OCR_API_KEY is not configured.");
            return { raw_text: null, confidence: 0, error: 'OCR_PROVIDER_NOT_CONFIGURED' };
        }

        try {
            // Call OCR.Space API as an example of a freemium HTTP provider
            // In a real production system, this could be Azure, Google Vision, etc.
            const formData = new URLSearchParams();
            formData.append('apikey', apiKey);
            formData.append('base64Image', 'data:image/jpeg;base64,' + base64Data);
            formData.append('language', 'eng');
            formData.append('OCREngine', '2'); // Engine 2 is better for numbers/special chars

            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            const data = await response.json();
            
            if (data.IsErroredOnProcessing || !data.ParsedResults || data.ParsedResults.length === 0) {
                return { raw_text: null, confidence: 0, error: 'OCR processing failed or no text found.' };
            }

            const rawText = data.ParsedResults[0].ParsedText.trim().replace(/\r?\n|\r/g, ' ');
            
            return {
                raw_text: rawText,
                confidence: 0.9, // OCR.Space doesn't return character confidence for free tier, we estimate
                error: null
            };

        } catch (error) {
            console.error("[PlateOCRService] Error:", error);
            return { raw_text: null, confidence: 0, error: error.message };
        }
    }

    static mockRecognize(base64Image) {
        // Simple mock for E2E tests based on the prompt's scenario
        // In a real test, the image metadata or base64 could encode the mock response, 
        // but here we just return a static mock that allows testing AI agreement/disagreement.
        
        // Let's check for specific test payloads if passed in base64 string
        if (base64Image.includes('mock_foreign')) {
            return { raw_text: "M-AB 1234 D", confidence: 0.9, error: null };
        }
        if (base64Image.includes('mock_ambiguous')) {
            return { raw_text: "AB1234", confidence: 0.9, error: null };
        }
        if (base64Image.includes('mock_disagree')) {
            return { raw_text: "AB-123-C0", confidence: 0.9, error: null };
        }
        if (base64Image.includes('mock_unreadable')) {
            return { raw_text: null, confidence: 0, error: "UNREADABLE" };
        }
        if (base64Image.includes('mock_duplicate')) {
            return { raw_text: "AB 123 CD", confidence: 0.9, error: null }; // spaces will be normalized to AB-123-CD
        }

        // Default: standard french plate agreement
        return { raw_text: "AB-123-CD F", confidence: 0.95, error: null };
    }
}

module.exports = PlateOCRService;
