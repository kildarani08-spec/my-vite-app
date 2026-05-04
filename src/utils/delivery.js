function addBusinessDays(baseDate, days) {
  const result = new Date(baseDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return result;
}

export function formatDeliveryDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function getDeliveryEstimate(baseDate = new Date(), options = {}) {
  const minDays = Number(options.minDays ?? 3);
  const maxDays = Number(options.maxDays ?? 5);
  const startDate = addBusinessDays(baseDate, minDays);
  const endDate = addBusinessDays(baseDate, maxDays);

  return {
    startDate,
    endDate,
    startLabel: formatDeliveryDate(startDate),
    endLabel: formatDeliveryDate(endDate),
    rangeLabel: `${formatDeliveryDate(startDate)} - ${formatDeliveryDate(endDate)}`,
    shortLabel: `Estimated delivery: ${formatDeliveryDate(startDate)} - ${formatDeliveryDate(endDate)}`,
    byLabel: `Get it by ${formatDeliveryDate(endDate)}`,
  };
}

export function getDeliveryStatusText(status, baseDate = new Date()) {
  const normalized = String(status || "").trim().toLowerCase();
  const estimate = getDeliveryEstimate(baseDate);

  if (normalized === "delivered") {
    return `Delivered on ${estimate.endLabel}`;
  }

  if (normalized === "shipped") {
    return `Out for delivery soon · expected by ${estimate.endLabel}`;
  }

  if (normalized === "processing" || normalized === "paid" || normalized === "confirmed") {
    return `Estimated arrival ${estimate.rangeLabel}`;
  }

  if (normalized === "cancelled" || normalized === "refunded") {
    return "This order is no longer in delivery.";
  }

  return `Estimated arrival ${estimate.rangeLabel}`;
}
