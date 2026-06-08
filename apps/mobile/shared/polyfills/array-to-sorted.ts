if (Array.prototype.toSorted == null) {
  Object.defineProperty(Array.prototype, "toSorted", {
    configurable: true,
    value: function toSorted<T>(this: readonly T[], compareFn?: (left: T, right: T) => number) {
      return Array.from(this).sort(compareFn);
    },
    writable: true,
  });
}

export {};
