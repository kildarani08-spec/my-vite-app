export const FREE_SHIPPING_THRESHOLD = 699;
export const STANDARD_SHIPPING_FEE = 80;

export const roundCurrency = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const roundPayableTotal = (value) => Math.round(toNumber(value));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveShippingConfig = (options = {}) => {
  const freeShippingThreshold = toNumber(options.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD);
  const standardShippingFee = toNumber(options.standardShippingFee ?? STANDARD_SHIPPING_FEE);
  const freeShippingEnabled = options.freeShippingEnabled !== false;

  return {
    freeShippingThreshold,
    standardShippingFee,
    freeShippingEnabled,
  };
};

export const calculateMerchandiseSubtotal = (items = []) =>
  roundCurrency(items.reduce((sum, item) => {
    const unitPrice = toNumber(
      item?.effective_price ?? item?.snapshot_subtotal ?? item?.snapshot_price
    );
    const quantity = toNumber(item?.quantity || 0);

    if (item?.effective_price != null || item?.snapshot_price != null) {
      return sum + unitPrice * quantity;
    }

    return sum + unitPrice;
  }, 0));

export const calculateShippingCost = (subtotal, options = {}) => {
  const { freeShippingThreshold, standardShippingFee, freeShippingEnabled } = resolveShippingConfig(options);
  const amount = toNumber(subtotal);

  if (amount <= 0) {
    return 0;
  }

  if (freeShippingEnabled && (freeShippingThreshold <= 0 || amount >= freeShippingThreshold)) {
    return 0;
  }

  return standardShippingFee;
};

export const buildOrderSummary = (items = [], options = {}) => {
  const { freeShippingThreshold, freeShippingEnabled } = resolveShippingConfig(options);
  const subtotal = calculateMerchandiseSubtotal(items);
  const shipping = roundCurrency(calculateShippingCost(subtotal, options));
  const paymentDiscount = 0;
  const grandTotal = roundPayableTotal(Math.max(0, subtotal + shipping - paymentDiscount));
  const remainingForFreeShipping =
    freeShippingEnabled && subtotal > 0 && freeShippingThreshold > 0 && subtotal < freeShippingThreshold
      ? roundCurrency(freeShippingThreshold - subtotal)
      : 0;

  return {
    subtotal,
    shipping,
    paymentDiscount,
    grandTotal,
    remainingForFreeShipping,
  };
};