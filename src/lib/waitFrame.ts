export const waitFrame = (): Promise<void> => {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
