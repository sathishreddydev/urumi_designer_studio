export function getStudioLogoUrl(logoUrl: string, logoData: Buffer | null | undefined): string {
  if (!logoData || logoData.length === 0) return logoUrl;
  return `data:image/webp;base64,${logoData.toString("base64")}`;
}

export function getStudioFaviconUrl(faviconData: Buffer | null | undefined): string | null {
  if (!faviconData || faviconData.length === 0) return null;
  return `data:image/png;base64,${faviconData.toString("base64")}`;
}
