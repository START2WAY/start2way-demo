# Input Schema

The agent will receive a JSON payload containing:

```json
{
  "image": "base64_encoded_image_string_or_url",
  "ocr_result": {
    "provider": "OCR.Space",
    "raw_text": "AB-123-CD",
    "lines": ["AB-123-CD", "F"],
    "confidence": 0.95
  }
}
```
If `ocr_result` is null or missing, the agent must rely entirely on its visual analysis capabilities.
