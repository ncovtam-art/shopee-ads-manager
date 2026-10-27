const publicAssets = new Set([
  "/favicon.ico", "/file.svg", "/globe.svg", "/next.svg", "/vercel.svg", "/window.svg",
]);

export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/_next/") || publicAssets.has(pathname);
}
