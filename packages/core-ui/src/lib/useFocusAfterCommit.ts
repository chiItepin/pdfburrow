import { useLayoutEffect, useState } from "react";

export const useFocusAfterCommit = () => {
  const [request, setRequest] = useState<{ target: () => HTMLElement | null } | null>(null);
  useLayoutEffect(() => {
    request?.target()?.focus();
  }, [request]);
  return (target: () => HTMLElement | null) => setRequest({ target });
};
