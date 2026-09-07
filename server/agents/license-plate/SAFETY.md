# Safety & Data Minimization

1. **RAW PLATE IMAGE PERMANENTLY STORED = NO**. The image is only passed transiently to the agent for inference and must be discarded immediately after.
2. **No Memory**: The agent is stateless. Do not remember previous plates.
3. **No PII Extraction**: Ignore all other text, faces, or people in the image.
4. **No Console Logs**: Do not log the base64 image or any secrets.
5. **Secrets**: API keys must be provided at runtime via environment variables and never logged or stored in prompt files.
