/* globals
CONFIG,
PIXI,
renderTemplate
*/
"use strict";

import { MODULE_ID } from "./const.js";
import { getTopLeftPoint } from "./grid_coordinates.js";

export function log(...args) {
  try {
    if ( CONFIG[MODULE_ID].debug ) console.debug(MODULE_ID, "|", ...args);
  } catch(e) {
    // Empty
  }
}

/**
 * Get the two points perpendicular to line A --> B at A, a given distance from the line A --> B
 * @param {PIXI.Point} A
 * @param {PIXI.Point} B
 * @param {number} distance
 * @returns {[PIXI.Point, PIXI.Point]} Points on either side of A.
 */
export function perpendicularPoints(A, B, distance = 1) {
  const delta = B.subtract(A);
  const pt0 = new PIXI.Point(A.x - delta.y, A.y + delta.x);
  return [
    A.towardsPoint(pt0, distance),
    A.towardsPoint(pt0, -distance)
  ];
}

/**
 * Determine if a token is currently snapped to the grid.
 * @param {Token} token
 * @returns {boolean}
 */
export function tokenIsSnapped(token) {
  const tokenLoc = PIXI.Point.fromObject(token.document);
  const snappedPt = getTopLeftPoint(tokenLoc);
  return tokenLoc.almostEqual(snappedPt);
}

/**
 * Create a very small rectangle for a point to be used with Quadtree.
 * @param {Point} pt
 * @returns {PIXI.Rectangle}
 */
export function boundsForPoint(pt) { return new PIXI.Rectangle(pt.x - 1, pt.y - 1, 3, 3); }

/**
 * From https://stackoverflow.com/questions/14446511/most-efficient-method-to-groupby-on-an-array-of-objects
 * Takes an Array<V>, and a grouping function,
 * and returns a Map of the array grouped by the grouping function.
 *
 * @param {Array} list An array of type V.
 * @param {Function} keyGetter A Function that takes the the Array type V as an input, and returns a value of type K.
 *                  K is generally intended to be a property key of V.
 *                  keyGetter: (input: V) => K): Map<K, Array<V>>
 *
 * @returns Map of the array grouped by the grouping function. map = new Map<K, Array<V>>()
 */
export function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach(item => {
    const key = keyGetter(item);
    const collection = map.get(key);

    if (!collection) map.set(key, [item]);
    else collection.push(item);
  });
  return map;
}

/**
 * Helper to get a rectangular bounds between two points.
 * @param {PIXI.Point} a
 * @param {PIXI.Point} b
 * @returns {PIXI.Rectangle}
 */
export function segmentBounds(a, b) {
  if ( !b || a.equals(b) ) return new PIXI.Rectangle(a.x - 1, a.y - 1, 3, 3);
  const xMinMax = Math.minMax(a.x, b.x);
  const yMinMax = Math.minMax(a.y, b.y);
  return new PIXI.Rectangle(xMinMax.min, yMinMax.min, xMinMax.max - xMinMax.min, yMinMax.max - yMinMax.min);
}


/**
 * Helper to inject configuration html into the application config.
 */
export async function injectConfiguration(app, html, data, template, findString) {
  const myHTML = await renderTemplate(template, data);
  const form = html.find(findString);
  form.append(myHTML);
  app.setPosition(app.position);
}

/**
 * Find all array objects that match a condition, remove them from the array, and return them.
 * Like Array.findSplice, but handles multiples.
 * Modifies the array in place
 * @param {array} arr       Array to search
 * @param {function} filterFn   Function used for the filter test
 * @returns {array}
 */
export function filterSplice(arr, filterFn) {
  const indices = [];
  const filteredElems = arr.filter((elem, idx, arr) => {
    if ( !filterFn(elem, idx, arr) ) return false;
    indices.push(idx);
    return true;
  });
  indices.sort((a, b) => b - a); // So we can splice without changing other indices.
  indices.forEach(idx => arr.splice(idx, 1));
  return filteredElems;
}

/**
 * Get the key for a given object value. Presumes unique values, otherwise returns first.
 */
export function keyForValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

/**
 * Calculate the percent area overlap of one shape on another.
 * @param {PIXI.Rectangle|PIXI.Polygon} overlapShape
 * @param {PIXI.Rectangle|PIXI.Polygon} areaShape
 * @returns {number} Value between 0 and 1.
 */
export function percentOverlap(overlapShape, areaShape, totalArea) {
  if ( !overlapShape.overlaps(areaShape) ) return 0;
  const intersection = overlapShape.intersectPolygon(areaShape.toPolygon());
  const ixArea = intersection.area;
  totalArea ??= areaShape.area;
  return ixArea / totalArea;
}
