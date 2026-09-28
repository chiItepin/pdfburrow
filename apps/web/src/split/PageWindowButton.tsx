import { useDroppable } from "@dnd-kit/react";
import { Button } from "@repo/core-ui";

export const PageWindowButton = ({
  direction,
  unavailable,
  paused,
  editable,
  dragging,
  onNavigate,
}: {
  direction: "previous" | "next";
  unavailable: boolean;
  paused: boolean;
  editable: boolean;
  dragging: boolean;
  onNavigate: () => void;
}) => {
  const { ref, isDropTarget } = useDroppable({
    id: `${direction}-pages`,
    accept: "pdf-page",
    disabled: unavailable || paused || !editable,
  });
  return (
    <Button
      ref={ref}
      variant={isDropTarget ? "secondary" : "outline"}
      disabled={paused || unavailable}
      aria-disabled={dragging}
      className={isDropTarget ? "border-primary" : undefined}
      onClick={() => {
        if (!dragging) {
          onNavigate();
        }
      }}
    >
      {direction === "previous" ? "Previous pages" : "Next pages"}
    </Button>
  );
};
