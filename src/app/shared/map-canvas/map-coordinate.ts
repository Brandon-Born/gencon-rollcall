export interface CoordinatePoint {
  x: number;
  y: number;
}

export interface CoordinateBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function mapPercentWithinBounds(
  point: CoordinatePoint,
  bounds: CoordinateBounds,
): CoordinatePoint | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;

  if (point.x < bounds.left || point.x > right || point.y < bounds.top || point.y > bottom) {
    return null;
  }

  return {
    x: ((point.x - bounds.left) / bounds.width) * 100,
    y: ((point.y - bounds.top) / bounds.height) * 100,
  };
}
