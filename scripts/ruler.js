import { MODULE_ID, log } from "./module.js";


/**
 * Modified Ruler 
 * Measure elevation change at each waypoint and destination.
 * Modify distance calculation accordingly.
 * Display current elevation change and change at each waypoint.
 */
 
/**
 * Typical Ruler workflow:
 * - clear when drag starts
 * - create initial waypoint
 * - measure (likely multiple)
 * - add'l waypoints (optional)
 * - possible token movement
 * - clear when drag abandoned
 */
 
// wrapping the constructor appears not to work.
// see https://github.com/ruipin/fvtt-lib-wrapper/issues/14

/*
 * Track elevation increments for waypoints.
 * @type Array of integers
 */
Object.defineProperty(Ruler.prototype, "elevation_increments", {
  value: [],
  writable: true,
  configurable: true
});

/* 
 * Track the elevation increment for the destination
 * @type Integer
 */
Object.defineProperty(Ruler.prototype, "destination_elevation_increment", {
  value: 0,
  writable: true,
  configurable: true
});

/*
 * Modify the elevation and trigger updating accordingly.
 */
Object.defineProperty(Ruler.prototype, "changeElevation", {
  value: function changeElevation(elevation_increment) {
    log(`we are changing elevation by ${elevation_increment}!`);
    this.destination_elevation_increment += elevation_increment;
  },
  writable: true,
  configurable: true
});

/* 
 * Get the text label for elevation for a segment of the measurement.
 * Compare _getSegmentLabel
 * @param {number} segmentElevationIncrement
 * @param {number} totalElevationIncrement
 * @param {boolean} isTotal
 * @return {string}
 */
Object.defineProperty(Ruler.prototype, "_getSegmentElevationLabel", {
  value: function _getSegmentElevationLabel(segmentElevationIncrement, totalElevationIncrement, isTotal) {
  const units = canvas.scene.data.gridUnits;
  
  const segmentArrow = (segmentElevationIncrement > 0) ? "↑" :
                      (segmentElevationIncrement < 0) ? "↓" :
                      "";
  
  let label = `${segmentArrow}${Math.round(segmentDistance * 100) / 100} ${units}`;
  if ( isTotal ) {
      const totalArrow = (totalElevationIncrement > 0) ? "↑" :
                      (totalElevationIncrement < 0) ? "↓" :
                      "";
      label += ` [${totalArrow}${Math.round(totalDistance * 100) / 100} ${units}]`;
  }
  return label;
},
 writable: true,
 configurable: true
 });
 
 
/**
 * Calculate a new point by projecting the elevated point back onto the 2-D surface
 * If the movement on the plane is represented by moving from point A to point B,
 *   and you also move 'height' distance orthogonal to the plane, the distance is the
 *   hypotenuse of the triangle formed by A, B, and C, where C is orthogonal to B.
 *   Project by rotating the vertical triangle 90º, then calculate the new point C. 
 *
 * Cx = { height * (By - Ay) / dist(A to B) } + Bx
 * Cy = { height * (Bx - Ax) / dist(A to B) } + By
 * @param {{x: number, y: number}} A
 * @param {{x: number, y: number}} B
 */
function ProjectElevatedPoint(A, B, height) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const distance = Math.hypot(dy, dx);
  const projected_x = ((height * (B.y - A.y)) / distance) + B.x;
  const projected_y = ((height * (B.x - A.x)) / distance) + B.y;
  return new PIXI.Point(projected_x, projected_y);
}

// will need to update measuring to account for elevation
export function elevationRulerMeasure(wrapped, ...args) {
  log("we are measuring!");
  log(`${this.waypoints.length} waypoints. ${this.destination_elevation_increment} elevation increments for destination. ${this.elevation_increments} elevation waypoints.`);
  
  // if no elevation present, go with original function.
  if(!this.destination_elevation_increment &&
     (!this.elevation_increments ||
       this.elevation_increments.reduce((a, b) => a == 0 && b == 0, true) 
     )) {
     log("Using original measure");
     return wrapped(...args);
  }  
  
  // Mostly a copy from Ruler.measure, but adding in distance for elevation
  // Original segments need to be retained so that the displayed path is correct.
  // But the distances need to be modified to account for segment elevation.
  // Project the elevated point back to the 2-D space, using a rotated right triangle.
  // See, e.g. https://math.stackexchange.com/questions/927802/how-to-find-coordinates-of-3rd-vertex-of-a-right-angled-triangle-when-everything

  destination = new PIXI.Point(...canvas.grid.getCenter(destination.x, destination.y));
  const waypoints = this.waypoints.concat([destination]);
  const r = this.ruler;
  this.destination = destination;
  
  // Iterate over waypoints and construct segment rays
  // Also create elevation segments, adjusting segments for elevation
  const segments = [];
  const elevation_segments = [];
  for ( let [i, dest] of waypoints.slice(1).entries() ) {
    const origin = waypoints[i];
    const label = this.labels.children[i];
    const ray = new Ray(origin, dest);
    
    // first waypoint is origin; elevation increment is 0.
    // need to account for units of the grid
    // canvas.scene.data.grid e.g. 140; canvas.scene.data.gridDistance e.g. 5
    const elevation = this.elevation_increments[i + 1] * canvas.scene.data.gridDistance * canvas.scene.data.grid; 
    const elevated_dest = ProjectElevatedPoint(origin, dest, elevation);
    const ray_elevated = new Ray(origin, elevated_dest);
    
    if ( ray_elevated.distance < 10 ) {
      if ( label ) label.visible = false;
      continue;
    }
    segments.push({ray, label});
    elevation_segments.push({ray_elevated, label});
  }
  
  // Compute measured distance
	const distances = canvas.grid.measureDistances(elevation_segments, {gridSpaces});
	let totalDistance = 0;
	let totalElevation = 0;
	for ( let [i, d] of distances.entries() ) {
		totalDistance += d;
		
		
		let s = segments[i];
		s.last = i === (segments.length - 1);
		s.distance = d;
		s.text = this._getSegmentLabel(d, totalDistance, s.last);
		
		// add in elevation text if elevation has changed
		if(elevation_increments[i + 1] != 0) {
		  const elevation = this.elevation_increments[i + 1] * canvas.scene.data.gridDistance * canvas.scene.data.grid;
		  totalElevation += elevation;
		  s.text = s.text + this._getSegmentElevationLabel(elevation, totalElevation, s.last);
		}
	}
	
	// Clear the grid highlight layer
	const hlt = canvas.grid.highlightLayers[this.name];
	hlt.clear();
	// Draw measured path
	r.clear();
	for ( let s of segments ) {
		const {ray, label, text, last} = s;
		// Draw line segment
		r.lineStyle(6, 0x000000, 0.5).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y)
		 .lineStyle(4, this.color, 0.25).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
		// Draw the distance label just after the endpoint of the segment
		if ( label ) {
			label.text = text;
			label.alpha = last ? 1.0 : 0.5;
			label.visible = true;
			let labelPosition = ray.project((ray.distance + 50) / ray.distance);
			label.position.set(labelPosition.x, labelPosition.y);
		}
		// Highlight grid positions
		this._highlightMeasurement(ray);
	}
	// Draw endpoints
	for ( let p of waypoints ) {
		r.lineStyle(2, 0x000000, 0.5).beginFill(this.color, 0.25).drawCircle(p.x, p.y, 8);
	}
	// Return the measured segments
	return segments;
}

// moveToken should modify token elevation 
export function elevationRulerMoveToken(wrapped, ...args) {
  log("we are moving!");
  return wrapped(...args);
}

// clear should reset elevation info
export function elevationRulerClear(wrapped, ...args) {
  log("we are clearing!", this);
  
  /**
   * The set of elevation increments corresponding to waypoints.
   * Note: waypoint 0 is origin and should be elevation 0 (no increment +/-)
   * type: Array of integers
   */  
  // setFlag not a function for Ruler object
  this.elevation_increments = [];
  
  /**
   * The current destination point elevation increment relative to origin.
   * type: integer
   */ 
  this.destination_elevation_increment = 0;
  
  
  return wrapped(...args);
}

// update will need to transfer relevant elevation data (probably?)
export function elevationRulerUpdate(wrapped, ...args) {
  log("we are updating!", this);
  return wrapped(...args);
}

// adding waypoint should also add elevation info
export function elevationRulerAddWaypoint(wrapped, ...args) {
  log("adding waypoint!");
  
  this.elevation_increments.push(this.destination_elevation_increment);
  this.destination_elevation_increment = 0;
  
  return wrapped(...args);
}

// removing waypoint should also remove elevation info
export function elevationRulerRemoveWaypoint(wrapped, ...args) {
  log("removing waypoint!");
  
  this.elevation_increments.pop();
  this.destination_elevation_increment = 0;
  
  return wrapped(...args);
}

export function incrementElevation() {
  const ruler = canvas.controls.ruler;
  log("Trying to increment...", ruler);
  if(!ruler || !ruler.active) return;
  ruler.changeElevation(1);
}

export function decrementElevation() {
  const ruler = canvas.controls.ruler;
  log("Trying to decrement...", ruler);
  if(!ruler || !ruler.active) return;
  ruler.changeElevation(-1);
}

