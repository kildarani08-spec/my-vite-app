const DEFAULT_IMAGE_PLACEHOLDER = "https://via.placeholder.com/600x600?text=Image";

export function resolveImageUrl(value, fallback = DEFAULT_IMAGE_PLACEHOLDER) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  // Just use the filename directly, since images sit at the public root
  const filename = raw.split("/").pop();

  return `/${filename}`;
}
