import { useEffect } from "react";

export const useBeforeUnload = (hasWork: boolean) => {
  useEffect(() => {
    if (!hasWork) {
      return;
    }
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [hasWork]);
};
