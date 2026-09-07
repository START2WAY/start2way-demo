class CircuitRouteMatrixProvider {
  static async computeMatrix(origins, destinations) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }
    // TODO: Call Google Routes API
    return { status: 'FAILED', error: 'Not implemented yet' };
  }
}
module.exports = CircuitRouteMatrixProvider;
