/* The portal's records live in plain objects (model/data.js) that actions change in place. A change
   is announced with refresh(); every component that reads records re-renders through useVersion. */
import { useReducer, useSyncExternalStore } from 'react';

let version = 0;

const listeners = new Set();

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const refresh = () => {
  version++;
  listeners.forEach(listener => listener());
};

export const useVersion = () => useSyncExternalStore(subscribe, () => version);

export const useRedraw = () => useReducer(n => n + 1, 0)[1];
