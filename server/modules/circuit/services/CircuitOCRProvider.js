class CircuitOCRProvider {
  static async extract(imageBuffer) {
    if (!process.env.CIRCUIT_OCR_PROVIDER) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }
    // TODO: integrate with real OCR API
    return { status: 'FAILED', error: 'Not implemented yet' };
  }
}
module.exports = CircuitOCRProvider;
