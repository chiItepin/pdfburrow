import { useEffect, useId, useRef } from "react";
import { Button } from "../primitives/Button";
export const ConfirmDiscard = ({
  open,
  description,
  onKeep,
  onDiscard,
}: {
  open: boolean;
  description: string;
  onKeep: () => void;
  onDiscard: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      keepButton.current?.focus();
    } else {
      dialog.current?.close();
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
      className="m-auto max-w-md rounded-lg border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        Discard this work?
      </h2>
      <p id={descriptionId} className="my-4">
        {description}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button ref={keepButton} onClick={onKeep}>
          Keep working
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </dialog>
  );
};
