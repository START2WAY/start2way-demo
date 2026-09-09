class CircuitRouteMatrixProvider {
  static async computeMatrix(origins, destinations) {
    if (!process.env.GOOGLE_ROUTES_API_KEY) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }

    try {
      const toWaypoint = (point) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: point.latitude,
              longitude: point.longitude
            }
          }
        }
      });

      const body = {
        origins: origins.map(toWaypoint),
        destinations: destinations.map(toWaypoint),
        travelMode: 'DRIVE',
      };

      const response = await fetch(
        'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.GOOGLE_ROUTES_API_KEY,
            'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,status',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return {
          status: 'FAILED',
          error: `Route Matrix API HTTP ${response.status}: ${errText}`
        };
      }

      const data = await response.json();

      return {
        status: 'OK',
        elements: data.map((el) => ({
          originIndex: el.originIndex,
          destinationIndex: el.destinationIndex,
          distanceMeters: el.distanceMeters,
          duration: el.duration,
          status: el.status,
        })),
      };
    } catch (err) {
      return {
        status: 'FAILED',
        error: err.message
      };
    }
  }
}

module.exports = CircuitRouteMatrixProvider;
