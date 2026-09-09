const CircuitAgentWrapper = require('./CircuitAgentWrapper.js');
const CircuitGeocodingProvider = require('./CircuitGeocodingProvider.js');
const CircuitRouteMatrixProvider = require('./CircuitRouteMatrixProvider.js');
const CircuitOptimizationProvider = require('./CircuitOptimizationProvider.js');

class CircuitPipeline {
  static async run(input) {
    const qualityControl = await CircuitAgentWrapper.auditInput(
      input.rows,
      input.input_method
    );

    if (qualityControl.status !== 'OK') {
      return {
        status: 'FAILED',
        failedStep: 'quality-control',
        error: qualityControl.error
      };
    }

    const geocodedStops = [];

    for (let i = 0; i < input.rows.length; i++) {
      const geocodeResult = await CircuitGeocodingProvider.geocode(
        input.rows[i].address
      );

      if (geocodeResult.status !== 'OK') {
        return {
          status: 'FAILED',
          failedStep: 'geocode',
          error: geocodeResult.error
        };
      }

      geocodedStops.push({
        id: `row-${i}`,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude
      });
    }

    const routeMatrixResult =
      await CircuitRouteMatrixProvider.computeMatrix(
        geocodedStops,
        geocodedStops
      );

    if (routeMatrixResult.status !== 'OK') {
      return {
        status: 'FAILED',
        failedStep: 'route-matrix',
        error: routeMatrixResult.error
      };
    }

    const constraints = {
      vehicleStart: input.vehicleStart
    };

    if (input.vehicleEnd) {
      constraints.vehicleEnd = input.vehicleEnd;
    }

    const optimizationResult =
      await CircuitOptimizationProvider.optimize(
        geocodedStops,
        constraints
      );

    if (optimizationResult.status !== 'OK') {
      return {
        status: 'FAILED',
        failedStep: 'optimize',
        error: optimizationResult.error
      };
    }

    if (
      !optimizationResult.routes ||
      !optimizationResult.routes[0] ||
      !Array.isArray(optimizationResult.routes[0].orderedStops)
    ) {
      return {
        status: 'FAILED',
        failedStep: 'optimize',
        error: 'Invalid optimization response format'
      };
    }

    const orderedStops =
      optimizationResult.routes[0].orderedStops;

    const auditResult =
      await CircuitAgentWrapper.auditOptimization(
        geocodedStops,
        orderedStops
      );

    if (auditResult.status !== 'OK') {
      return {
        status: 'FAILED',
        failedStep: 'audit-optimization',
        error: auditResult.error
      };
    }

    return {
      status: 'OK',
      qualityControl: {
        issues: qualityControl.issues
      },
      geocodedStops,
      optimizedRoute: {
        orderedStops
      },
      optimizationAudit: {
        issues: auditResult.issues
      }
    };
  }
}

module.exports = CircuitPipeline;
