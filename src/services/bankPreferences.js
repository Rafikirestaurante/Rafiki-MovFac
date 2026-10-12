export function getSelectedBanks(userId) {
  if (typeof localStorage === "undefined") return ["bancolombia"];
  try {
    const saved = JSON.parse(localStorage.getItem(`rafiki_banks_${userId}`));
    const banks = Array.isArray(saved) ? saved.filter(bank => ["bancolombia","nequi"].includes(bank)) : [];
    return banks.length ? banks : ["bancolombia"];
  } catch { return ["bancolombia"]; }
}
export function saveSelectedBanks(userId,banks) {
  if (!banks.length) return;
  localStorage.setItem(`rafiki_banks_${userId}`,JSON.stringify(banks));
}
