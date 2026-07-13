export interface StackableMapMarker {
  key: string;
  xPercent: number;
  yPercent: number;
  diameterPx: number;
  baseZIndex: number;
}

const ROTATING_MARKER_Z_INDEX = 8;
const SELECTED_MARKER_Z_INDEX = 20;

export function mapMarkerZIndexes(
  markers: ReadonlyArray<StackableMapMarker>,
  viewportWidth: number,
  viewportHeight: number,
  mapScale: number,
  rotationStep: number,
  selectedKey: string | null,
): ReadonlyMap<string, number> {
  const zIndexes = new Map(markers.map((marker) => [marker.key, marker.baseZIndex]));

  if (viewportWidth > 0 && viewportHeight > 0 && mapScale > 0) {
    const sortedMarkers = [...markers].sort((first, second) => first.key.localeCompare(second.key));
    const visited = new Set<string>();

    for (const marker of sortedMarkers) {
      if (visited.has(marker.key)) {
        continue;
      }

      const overlapGroup: StackableMapMarker[] = [];
      const pending = [marker];
      visited.add(marker.key);

      while (pending.length > 0) {
        const current = pending.pop();

        if (!current) {
          continue;
        }

        overlapGroup.push(current);

        for (const candidate of sortedMarkers) {
          if (
            visited.has(candidate.key) ||
            !markersOverlap(current, candidate, viewportWidth, viewportHeight, mapScale)
          ) {
            continue;
          }

          visited.add(candidate.key);
          pending.push(candidate);
        }
      }

      if (overlapGroup.length > 1) {
        const frontMarker = overlapGroup[positiveModulo(rotationStep, overlapGroup.length)];
        zIndexes.set(frontMarker.key, ROTATING_MARKER_Z_INDEX);
      }
    }
  }

  if (selectedKey && zIndexes.has(selectedKey)) {
    zIndexes.set(selectedKey, SELECTED_MARKER_Z_INDEX);
  }

  return zIndexes;
}

function markersOverlap(
  first: StackableMapMarker,
  second: StackableMapMarker,
  viewportWidth: number,
  viewportHeight: number,
  mapScale: number,
): boolean {
  const horizontalDistance =
    (Math.abs(first.xPercent - second.xPercent) / 100) * viewportWidth * mapScale;
  const verticalDistance =
    (Math.abs(first.yPercent - second.yPercent) / 100) * viewportHeight * mapScale;
  const centerDistance = Math.hypot(horizontalDistance, verticalDistance);
  const combinedRadius = (first.diameterPx + second.diameterPx) / 2;

  return centerDistance < combinedRadius;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
