export type PageNumberItem = number | "ellipsis";

export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PageNumberItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages =
    currentPage <= 2
      ? [1, 2, 3, 4, totalPages]
      : currentPage >= totalPages - 2
        ? [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  const items: PageNumberItem[] = [];

  pages.forEach((pageNumber, index) => {
    if (index > 0 && pageNumber - pages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(pageNumber);
  });

  return items;
}

export function getPagesToPrefetch(
  currentPage: number,
  totalPages: number,
  visiblePages: readonly number[],
): number[] {
  const pages = new Set(visiblePages);

  for (const visiblePage of visiblePages) {
    for (const offset of [-1, 1]) {
      const neighbor = visiblePage + offset;
      if (neighbor >= 1 && neighbor <= totalPages) pages.add(neighbor);
    }
  }

  for (const offset of [-1, 1, 2, 3]) {
    const page = currentPage + offset;
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  pages.delete(currentPage);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}
