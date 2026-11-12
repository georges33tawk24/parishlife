/* Purpose: a small React hook for the administration and oversight screens: run an async load when
   the screen opens (and when its inputs change), keep the result, the error and a reload function.
   Main member: useLoad. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLoad(load, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const alive = useRef(true),
    run = useRef(load);
  run.current = load;
  useEffect(() => () => void (alive.current = false), []);
  const reload = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await run.current();
      if (alive.current) setState({ data, error: '', loading: false });
    } catch (error) {
      if (alive.current) setState({ data: null, error: error.message, loading: false });
    }
  }, []);
  useEffect(() => {
    reload();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload };
}
