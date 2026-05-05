export function getPathPatternFromPath(path: string): string {
  return path
    .replace(/\/\(.*?\)\//g, "/")
    .replace(/\/\$\$(\w+)/g, "/:$1(.*)")
    .replace(/\/\$/g, "/:");
}
