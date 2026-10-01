import { useRef } from "react";

export const useMenubarAction = () => {
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<(() => void) | null>(null);
  return {
    trigger,
    defer: (action: () => void) => () => {
      pending.current = action;
    },
    onCloseAutoFocus: (event: Event) => {
      const action = pending.current;
      if (!action) {
        return;
      }
      event.preventDefault();
      pending.current = null;
      trigger.current?.focus();
      action();
    },
  };
};
