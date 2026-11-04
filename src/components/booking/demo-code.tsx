import { cn } from "@/lib/utils";

/**
 * A deterministic, clearly-labelled internal reference pattern. It is NOT a
 * scannable railway QR code and must never be presented as one.
 */
export function DemoCode({
  value,
  size = 132,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const gridSize = 21;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const cells: boolean[] = [];
  let state = hash >>> 0;
  for (let i = 0; i < gridSize * gridSize; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    cells.push(((state >>> 0) & 3) !== 0);
  }
  const isFinder = (x: number, y: number) => {
    const inBox = (bx: number, by: number) =>
      x >= bx && x < bx + 7 && y >= by && y < by + 7;
    const isCorner = inBox(0, 0) || inBox(gridSize - 7, 0) || inBox(0, gridSize - 7);
    if (!isCorner) return null;
    const localX = x < 7 ? x : gridSize - 7 <= x ? x - (gridSize - 7) : -1;
    const localY = y < 7 ? y : gridSize - 7 <= y ? y - (gridSize - 7) : -1;
    if (localX < 0 || localY < 0) return false;
    const border = localX === 0 || localX === 6 || localY === 0 || localY === 6;
    const core = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
    return border || core;
  };

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <svg
        role="img"
        aria-label={`Decorative internal RAILVYN code for reference ${value}. Not a scannable railway QR code.`}
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        width={size}
        height={size}
        className="rounded-[10px] border border-line-light bg-white p-2"
        shapeRendering="crispEdges"
      >
        {Array.from({ length: gridSize * gridSize }, (_, index) => {
          const x = index % gridSize;
          const y = Math.floor(index / gridSize);
          const finder = isFinder(x, y);
          const filled = finder ?? cells[index];
          if (!filled) return null;
          return (
            <rect key={index} x={x} y={y} width={1} height={1} fill="#161A17" />
          );
        })}
      </svg>
      <p className="text-center text-[10px] leading-tight text-ink-muted">
        Internal decorative code
        <br />
        Not a scannable railway QR
      </p>
    </div>
  );
}
