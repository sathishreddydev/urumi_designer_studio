export function normalizeDomain(value: string): string {
  const input = value.trim();
  if (!input || /[/\\?#@\s]/.test(input) || input.includes("://")) {
    throw new Error("Enter a domain only, without a scheme, path, or spaces");
  }

  let url: URL;
  try {
    url = new URL(`http://${input}`);
  } catch {
    throw new Error("Enter a valid domain");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(hostname)
  ) {
    throw new Error("Enter a valid domain");
  }

  if (url.port && hostname !== "localhost" && !hostname.endsWith(".localhost")) {
    throw new Error("Do not include a port in the registered domain");
  }

  return hostname;
}

export function normalizePostgresUrl(value: string): string {
  const input = value.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid PostgreSQL connection URL");
  }
  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    !url.hostname ||
    !url.username ||
    !url.pathname ||
    url.pathname === "/"
  ) {
    throw new Error("Enter a valid PostgreSQL connection URL");
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }

  return input;
}

export function normalizeCloudinaryUrl(value: string): string {
  const input = value.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a Cloudinary URL in cloudinary://key:secret@cloud-name format");
  }
  if (
    url.protocol !== "cloudinary:" ||
    !url.username ||
    !url.password ||
    !url.hostname ||
    url.pathname !== "" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Enter a Cloudinary URL in cloudinary://key:secret@cloud-name format");
  }
  return input;
}

export function normalizeLogoUrl(value: string): string {
  const input = value.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid HTTPS logo image URL");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && !url.hostname.endsWith(".localhost")) {
    throw new Error("Logo URLs must use HTTPS");
  }
  return input;
}
