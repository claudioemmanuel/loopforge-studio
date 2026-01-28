/**
 * Dependency Line Routing Utility
 *
 * Provides path calculation for dependency lines between Kanban cards,
 * routing around obstacles and handling backward dependencies.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ConnectionPoints {
  from: Point;
  to: Point;
  fromRect: Rect;
  toRect: Rect;
}

export interface RoutedPath {
  path: string;
  isBackward: boolean;
}

/**
 * Determines if a dependency is "backward" (blocker is to the right of blocked card)
 */
export function isBackwardDependency(fromX: number, toX: number): boolean {
  return fromX > toX;
}

/**
 * Checks if a card is horizontally between two points
 */
function isCardInHorizontalPath(
  cardRect: Rect,
  fromX: number,
  toX: number,
  padding = 10,
): boolean {
  const minX = Math.min(fromX, toX) + padding;
  const maxX = Math.max(fromX, toX) - padding;
  return cardRect.left < maxX && cardRect.right > minX;
}

/**
 * Checks if a line would vertically intersect with a card
 */
function wouldIntersectVertically(
  cardRect: Rect,
  fromY: number,
  toY: number,
  routeY: number | null = null,
): boolean {
  const minY = Math.min(fromY, toY);
  const maxY = Math.max(fromY, toY);

  // If routing through a specific Y, check if card overlaps that route
  if (routeY !== null) {
    return cardRect.top <= routeY && cardRect.bottom >= routeY;
  }

  // Otherwise check if card is in the vertical range
  return cardRect.top <= maxY && cardRect.bottom >= minY;
}

/**
 * Finds cards that are obstacles in the path between two points
 */
export function findObstaclesInPath(
  from: Point,
  to: Point,
  allCardRects: Rect[],
  fromRect: Rect,
  toRect: Rect,
): Rect[] {
  return allCardRects.filter((cardRect) => {
    // Skip the source and target cards
    if (cardRect === fromRect || cardRect === toRect) return false;

    // Skip cards not in the horizontal path
    if (!isCardInHorizontalPath(cardRect, from.x, to.x)) return false;

    // Check if card would be in the way vertically
    return wouldIntersectVertically(cardRect, from.y, to.y);
  });
}

/**
 * Calculates a simple bezier curve path (for direct connections)
 */
export function simpleBezierPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

  return `
    M ${from.x} ${from.y}
    C ${from.x + controlOffset} ${from.y},
      ${to.x - controlOffset} ${to.y},
      ${to.x} ${to.y}
  `.trim();
}

/**
 * Calculates a routed path that goes above obstacles
 */
export function routedPathAboveObstacles(
  from: Point,
  to: Point,
  obstacles: Rect[],
  clearance = 25,
): string {
  if (obstacles.length === 0) {
    return simpleBezierPath(from, to);
  }

  // Find the minimum top of all obstacles (route above them)
  const minObstacleTop = Math.min(...obstacles.map((o) => o.top));
  const routeY = Math.min(
    minObstacleTop - clearance,
    Math.min(from.y, to.y) - 30,
  );

  // Create a path that goes: right → up → across → down → right
  const exitOffset = 20; // How far to go before turning up
  const entryOffset = 20; // How far before target to start coming down

  return `
    M ${from.x} ${from.y}
    C ${from.x + exitOffset} ${from.y}, ${from.x + exitOffset} ${routeY}, ${from.x + exitOffset * 2} ${routeY}
    L ${to.x - entryOffset * 2} ${routeY}
    C ${to.x - entryOffset} ${routeY}, ${to.x - entryOffset} ${to.y}, ${to.x} ${to.y}
  `.trim();
}

/**
 * Calculates a path for backward dependencies (subtle, direct)
 */
export function backwardPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  // For backward, use smaller control offset and curve slightly
  const controlOffset = Math.min(Math.abs(dx) * 0.3, 50);

  return `
    M ${from.x} ${from.y}
    C ${from.x - controlOffset} ${from.y},
      ${to.x + controlOffset} ${to.y},
      ${to.x} ${to.y}
  `.trim();
}

/**
 * Calculates the vertical offset for a line when multiple lines share endpoints
 * to prevent overlapping
 */
export function calculateLineOffset(
  lineIndex: number,
  totalLines: number,
  spread = 8,
): number {
  if (totalLines <= 1) return 0;
  const center = (totalLines - 1) / 2;
  return (lineIndex - center) * spread;
}

/**
 * Groups connections by their target card to calculate offsets
 */
export function groupConnectionsByTarget<T extends { toId: string }>(
  connections: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  connections.forEach((conn) => {
    const existing = groups.get(conn.toId) || [];
    existing.push(conn);
    groups.set(conn.toId, existing);
  });
  return groups;
}

/**
 * Main function to calculate a routed path with all considerations
 */
export function calculateRoutedPath(
  connection: ConnectionPoints,
  allCardRects: Rect[],
  lineIndex = 0,
  totalLinesForTarget = 1,
): RoutedPath {
  const { from, to, fromRect, toRect } = connection;

  // Check if this is a backward dependency
  const backward = isBackwardDependency(from.x, to.x);

  // Calculate vertical offset for multiple lines to same target
  const verticalOffset = calculateLineOffset(lineIndex, totalLinesForTarget);
  const adjustedFrom = { ...from, y: from.y + verticalOffset };
  const adjustedTo = { ...to, y: to.y + verticalOffset };

  if (backward) {
    // Backward dependencies: direct dotted line, no routing
    return {
      path: backwardPath(adjustedFrom, adjustedTo),
      isBackward: true,
    };
  }

  // Forward dependencies: check for obstacles and route if needed
  const obstacles = findObstaclesInPath(
    adjustedFrom,
    adjustedTo,
    allCardRects,
    fromRect,
    toRect,
  );

  if (obstacles.length === 0) {
    // No obstacles: simple bezier
    return {
      path: simpleBezierPath(adjustedFrom, adjustedTo),
      isBackward: false,
    };
  }

  // Route around obstacles
  return {
    path: routedPathAboveObstacles(adjustedFrom, adjustedTo, obstacles),
    isBackward: false,
  };
}
