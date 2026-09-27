import { useEffect, useRef } from "react";
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
      aria-labelledby="discard-title"
      aria-describedby="discard-description"
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
      className="m-auto max-w-md rounded-lg border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id="discard-title" className="text-xl font-semibold">
        Discard this work?
      </h2>
      <p id="discard-description" className="my-4">
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
