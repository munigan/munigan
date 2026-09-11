import { useEffect, useState } from "react";

// Reset with the render's identity so reopening or switching items never displays
// a previous request's skeleton. Cached data starts directly in the ready state.
export function useTooltipLoading(scope: string | null, pending: boolean) {
  const [state, setState] = useState({
    scope,
    pending,
    phase: 0,
    reveal: false,
  });
  if (state.scope !== scope || state.pending !== pending) {
    setState({
      scope,
      pending,
      phase: 0,
      reveal:
        scope !== null &&
        state.scope === scope &&
        state.pending &&
        !pending &&
        state.phase > 0,
    });
  }
  useEffect(() => {
    if (!scope || !pending) return;
    const visible = setTimeout(
      () => setState((current) => ({ ...current, phase: 1 })),
      120,
    );
    const slow = setTimeout(
      () => setState((current) => ({ ...current, phase: 2 })),
      2000,
    );
    return () => {
      clearTimeout(visible);
      clearTimeout(slow);
    };
  }, [scope, pending]);
  return {
    visible: !!scope && pending && state.phase > 0,
    slow: state.phase === 2,
    reveal: state.reveal,
  };
}

export function Skeleton({ width }: { width: string }) {
  return (
    <span
      className="compact-tooltip-skeleton"
      style={{ width }}
      aria-hidden="true"
    />
  );
}
