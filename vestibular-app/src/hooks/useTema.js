import { useState, useCallback } from "react";

// O tema é aplicado como data-theme no <html> (o index.html já o define
// antes do primeiro paint para evitar flash). Este hook lê/alterna esse
// atributo e persiste a escolha. A troca usa a View Transitions API
// quando disponível — um crossfade suave em toda a página.

const temaAtual = () =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export function useTema() {
  const [tema, setTema] = useState(temaAtual);

  const alternar = useCallback(() => {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    const aplicar = () => {
      document.documentElement.dataset.theme = novo;
      setTema(novo);
      try {
        localStorage.setItem("tema", novo);
      } catch {
        // Sem localStorage (modo privado etc.): o tema vale só na sessão.
      }
    };
    if (document.startViewTransition) {
      document.startViewTransition(aplicar);
    } else {
      aplicar();
    }
  }, []);

  return { tema, alternar };
}
