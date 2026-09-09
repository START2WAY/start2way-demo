class CircuitGeocodingProvider {
  static async geocode(address) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        const result = data.results[0];
        return {
          status: 'OK',
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
        };
      }

      if (data.status === 'ZERO_RESULTS') {
        return {
          status: 'ZERO_RESULTS',
          error: 'No results found for this address'
        };
      }

      return {
        status: 'FAILED',
        error: `Geocoding API error: ${data.status}`
      };
    } catch (err) {
      return {
        status: 'FAILED',
        error: err.message
      };
    }
  }
}
module.exports = CircuitGeocodingProvider;
