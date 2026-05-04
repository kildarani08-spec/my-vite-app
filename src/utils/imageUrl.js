const DEFAULT_IMAGE_PLACEHOLDER = "https://via.placeholder.com/640x480?text=Image";

export function resolveImageUrl(value, fallback = DEFAULT_IMAGE_PLACEHOLDER) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, "");
  if (normalized.startsWith("ecommerce/")) {
    return `/${normalized}`;
  }

  return `/ecommerce/${normalized}`;
}
