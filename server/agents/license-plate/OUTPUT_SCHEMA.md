# Output Schema

The agent MUST output ONLY valid JSON matching this schema:

```json
{
  "ai_candidate_raw": "AB 123 CD",
  "ai_candidate_normalized": "AB-123-CD",
  "ai_country_code": "FR",
  "ai_country_confidence": 0.99,
  "format_type": "CURRENT_FORMAT", 
  "format_match": true,
  "ambiguities": [],
  "confidence": 0.98,
  "requires_user_confirmation": true,
  "reason": "Matched French SIV format."
}
```

- `format_type` should be one of: `CURRENT_FORMAT`, `LEGACY_VALID_FORMAT`, `UNKNOWN_FORMAT`, `INVALID_FORMAT`.
- `requires_user_confirmation` is ALWAYS `true` in V1.
