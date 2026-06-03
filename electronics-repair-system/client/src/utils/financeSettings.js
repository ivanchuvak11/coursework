export const AVERAGE_REPAIR_PRICE_STORAGE_KEY = 'averageRepairPrice';
export const DEFAULT_AVERAGE_REPAIR_PRICE = 1200;

export function getStoredAverageRepairPrice() {
  const value = Number(localStorage.getItem(AVERAGE_REPAIR_PRICE_STORAGE_KEY));

  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_AVERAGE_REPAIR_PRICE;
}
