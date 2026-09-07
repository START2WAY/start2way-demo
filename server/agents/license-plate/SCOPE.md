# Scope of the License Plate Agent

## AUTHORIZED
- Analyze supplied image (or cropped version).
- Analyze provided OCR text output.
- Read visible alphanumeric characters.
- Detect probable registration country based on distinguishing marks and layout.
- Normalize formatting.
- Compare candidates to the known European plate catalog (PLATE_FORMATS.md).
- Identify ambiguities (e.g. O vs 0).
- Return a structured result matching OUTPUT_SCHEMA.md.

## STRICTLY FORBIDDEN
- Identify vehicle owner.
- Retrieve personal data (faces, people in background).
- Modify any vehicle data in the system.
- Modify any Employment or Company data.
- Access the START2WAY database directly (no SQLite or raw DB queries).
- Access the local LIC file or licensing logic.
- Execute side-effects (send emails, HTTP requests outside model inference).
- Guess a country if there is absolutely no hint and the format matches multiple countries.
