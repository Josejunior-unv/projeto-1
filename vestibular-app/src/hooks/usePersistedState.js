import { useState, useEffect } from "react";

// useState que persiste automaticamente em localStorage, restaurando o valor ao
// recarregar a página / reabrir o app. Usado para lembrar a navegação profunda
// (matéria aberta, seção, filtros, busca...) que não fica na URL.
export function usePersistedState(chave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo !== null ? JSON.parse(salvo) : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // ignora falha de escrita (ex.: cota cheia)
    }
  }, [chave, valor]);

  return [valor, setValor];
}
