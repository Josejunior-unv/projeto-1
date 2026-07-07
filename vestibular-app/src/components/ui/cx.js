// Junta classes condicionais (ignora valores falsy).
export const cx = (...classes) => classes.filter(Boolean).join(" ");
