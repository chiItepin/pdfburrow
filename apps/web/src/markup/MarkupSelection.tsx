import type { MarkupObject } from "@repo/pdf-engine";
import { markupCornerPosition, markupResizeCorners } from "./markupResize";

export const MarkupSelection = ({
  object,
  scale,
}: {
  object: MarkupObject | undefined;
  scale: number;
}) => {
  if (!object || object.kind === "note") {
    return null;
  }
  const size = 10 / scale;
  const hitSize = 24 / scale;
  return (
    <g data-markup-selection={object.id}>
      {markupResizeCorners.map((corner) => {
        const position = markupCornerPosition(object, corner);
        return (
          <g
            key={corner}
            data-markup-resize={corner}
            style={{ cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize" }}
          >
            <rect
              x={position.x - hitSize / 2}
              y={position.y - hitSize / 2}
              width={hitSize}
              height={hitSize}
              fill="transparent"
              strokeWidth={0}
              pointerEvents="all"
            />
            <rect
              x={position.x - size / 2}
              y={position.y - size / 2}
              width={size}
              height={size}
              fill="white"
              stroke="#205b49"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
};
