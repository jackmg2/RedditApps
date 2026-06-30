// Strict-mode DOM lookup: narrows via instanceof so no type casts are needed.
export const byId = <T extends HTMLElement>(id: string, ctor: new () => T): T => {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) {
    throw new Error(`Missing element #${id}`);
  }
  return el;
};
