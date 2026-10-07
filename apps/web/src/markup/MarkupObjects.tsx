import type { MarkupObject } from "@repo/pdf-engine";
import { layoutNote } from "@repo/pdf-engine/markup-layout";

const NoteText = ({
  object,
  fontBytes,
}: {
  object: MarkupObject & { kind: "note" };
  fontBytes: Uint8Array;
}) => {
  const layout = layoutNote(object.text, object.width, fontBytes);
  return (
    <text
      fontFamily="PDFBurrow Notes"
      fontSize={12}
      fill="black"
      style={{ fontKerning: "none", fontVariantLigatures: "none" }}
    >
      {layout.lines.map((line, index) => (
        <tspan key={index} x={0} y={layout.ascent + index * 14.4}>
          {line}
        </tspan>
      ))}
    </text>
  );
};
export const MarkupObjects = ({
  objects,
  selectedId,
  fontBytes,
}: {
  objects: readonly MarkupObject[];
  selectedId: string | null;
  fontBytes?: Uint8Array;
}) => (
  <>
    {objects.map((object) => (
      <g
        key={object.id}
        data-markup-id={object.id}
        transform={`translate(${object.x} ${object.y})`}
      >
        {object.kind === "highlight" ? (
          <rect width={object.width} height={object.height} fill="yellow" fillOpacity={0.3} />
        ) : object.kind === "note" ? (
          fontBytes && <NoteText object={object} fontBytes={fontBytes} />
        ) : (
          object.strokes.map((points, index) => (
            <polyline
              key={index}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="black"
              strokeWidth={object.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))
        )}
        <rect
          width={object.width}
          height={object.height}
          fill="transparent"
          stroke={selectedId === object.id ? "#205b49" : "none"}
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    ))}
  </>
);
