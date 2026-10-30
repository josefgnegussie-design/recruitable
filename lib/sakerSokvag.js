// Bara sökvägar på den egna sajten. Utan den här kontrollen skulle ?next= kunna
// peka vidare till en främmande domän, med vår adress som avsändare. "//" och
// "/\" släpps inte igenom: webbläsaren läser båda som början på en annan värd.
export function sakerSokvag(next) {
  return typeof next === "string" && /^\/[^/\\]/.test(next) ? next : null;
}
