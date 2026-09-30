import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode, KeyboardEventHandler } from "react";

export const MarkupDialog = ({
  title,
  children,
  onCancel,
  onKeyDown,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onKeyDown={onKeyDown}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <h2 id={id} className="mb-4 text-xl font-semibold">
        {title}
      </h2>
      {children}
    </dialog>
  );
};
