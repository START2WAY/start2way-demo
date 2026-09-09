class CircuitOptimizationProvider {
  static async optimize(stops, constraints) {
    try {
      let projectId;
      try {
        const projectIdResponse = await fetch(
          'http://metadata.google.internal/computeMetadata/v1/project/project-id',
          {
            headers: { 'Metadata-Flavor': 'Google' }
          }
        );

        if (!projectIdResponse.ok) {
          const errText = await projectIdResponse.text();
          return {
            status: 'FAILED',
            error: `Failed to fetch project ID: HTTP ${projectIdResponse.status} ${errText}`
          };
        }

        projectId = await projectIdResponse.text();
      } catch (err) {
        return {
          status: 'FAILED',
          error: `Failed to fetch project ID: ${err.message}`
        };
      }

      // Fetch OAuth token from metadata server
      let accessToken;
      try {
        const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
          headers: {
            'Metadata-Flavor': 'Google'
          }
        });
        
        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          return {
            status: 'FAILED',
            error: `Failed to fetch access token: HTTP ${tokenResponse.status} ${errText}`
          };
        }
        
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;
      } catch (err) {
        return {
          status: 'FAILED',
          error: `Failed to fetch access token: ${err.message}`
        };
      }

      // Build model for Route Optimization API
      const shipments = (stops || []).map(stop => ({
        pickups: [
          {
            arrivalLocation: {
              latitude: stop.latitude,
              longitude: stop.longitude
            }
          }
        ]
      }));

      const vehicle = {
        startLocation: {
          latitude: constraints.vehicleStart.latitude,
          longitude: constraints.vehicleStart.longitude
        }
      };

      if (constraints.vehicleEnd) {
        vehicle.endLocation = {
          latitude: constraints.vehicleEnd.latitude,
          longitude: constraints.vehicleEnd.longitude
        };
      }

      const body = {
        model: {
          shipments,
          vehicles: [vehicle]
        },
        objectives: [
          { type: 'MIN_TRAVEL_TIME' }
        ]
      };

      // Call Route Optimization API
      const url = `https://routeoptimization.googleapis.com/v1/projects/${projectId}:optimizeTours`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'FAILED',
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();

      // Map response to START2WAY contract
      const routes = [];
      if (data.routes && Array.isArray(data.routes)) {
        for (const route of data.routes) {
          const orderedStops = [];
          if (route.visits && Array.isArray(route.visits)) {
            for (const visit of route.visits) {
              const resolvedShipmentIndex = visit.shipmentIndex !== undefined ? visit.shipmentIndex : 0;

              if (visit.isPickup && stops[resolvedShipmentIndex]) {
                orderedStops.push({
                  id: stops[resolvedShipmentIndex].id,
                  shipmentIndex: resolvedShipmentIndex
                });
              }
            }
          }
          
          routes.push({
            vehicleIndex: route.vehicleIndex !== undefined ? route.vehicleIndex : 0,
            orderedStops
          });
        }
      }

      return {
        status: 'OK',
        routes
      };

    } catch (err) {
      return {
        status: 'FAILED',
        error: err.message
      };
    }
  }
}

module.exports = CircuitOptimizationProvider;
