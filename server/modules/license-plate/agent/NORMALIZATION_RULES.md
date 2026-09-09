# Normalization Rules

To ensure exact deduplication and matching:

1. **UPPERCASE**: Always convert all alphanumeric characters to uppercase.
2. **TRIM**: Remove leading and trailing spaces.
3. **SPACES AND SEPARATORS**: 
   - Remove spaces if they are not part of the standard format.
   - For France (SIV): `AB-123-CD`.
   - In general, produce a normalized string that matches the canonical country representation defined in `PLATE_FORMATS.md`.
4. **AMBIGUITIES**:
   - `0` (Zero) vs `O` (Letter O)
   - `1` (One) vs `I` (Letter I)
   - `5` (Five) vs `S` (Letter S)
   - `8` (Eight) vs `B` (Letter B)
   Do not silently guess if the image is blurry. Report ambiguities in the output array.
