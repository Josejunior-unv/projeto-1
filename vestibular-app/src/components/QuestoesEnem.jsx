
import { useState, useEffect } from 'react';

x

import {
  useEffect,
  useState,
} from "react";

import { buscarQuestoesDoAno } from "./enemService";


function QuestoesEnem() {
  const [questoes, setQuestoes] =
    useState([]);

  const [carregando, setCarregando] =
    useState(true);

  const [respostasUsuario, setRespostasUsuario] =
    useState({});

  useEffect(() => {
    async function iniciarCarga() {
      const dadosApi =
        await buscarQuestoesDoAno(
          2020
        );

      setQuestoes(dadosApi);

      setCarregando(false);
    }

    iniciarCarga();
  }, []);

  function responderQuestao(
    questaoId,
    alternativa
  ) {
    setRespostasUsuario(
      (prev) => ({
        ...prev,
        [questaoId]:
          alternativa,
      })
    );
  }

  if (carregando) {
    return (
      <div className="mt-8 p-8 rounded-2xl border border-gray-800 bg-gray-900/70 shadow-2xl text-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>

          <h2 className="text-blue-400 text-lg font-bold">
            Carregando questões
            oficiais do ENEM...
          </h2>

          <p className="text-gray-500 text-sm">
            Aguarde alguns
            segundos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mt-8">
      {questoes.map((questao) => {
        const questaoId = `${questao.year}-${questao.index}`;

        const respostaUsuario =
          respostasUsuario[
            questaoId
          ];

        return (
          <div
            key={questaoId}
            className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-7 shadow-2xl hover:border-blue-500/30 transition-all duration-300"
          >
            {/* TOPO */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg">
                  Questão{" "}
                  {
                    questao.index
                  }
                </span>

                <span className="text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg capitalize">
                  {
                    questao.discipline
                  }
                </span>
              </div>

              <span className="text-xs text-gray-500">
                {
                  questao.year
                }
              </span>
            </div>

            {/* ENUNCIADO */}
            <div className="mb-7">
              <h2 className="text-white text-lg font-bold mb-4">
                Enunciado
              </h2>

              <p className="text-gray-300 text-sm leading-7 whitespace-pre-line">
                {
                  questao.context
                }
              </p>
            </div>

            {/* IMAGENS */}
            {questao.files &&
              questao.files.length >
                0 && (
                <div className="flex flex-col gap-4 mb-7">
                  {questao.files.map(
                    (
                      imagem,
                      index
                    ) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-xl border border-gray-700 bg-black"
                      >
                        <img
                          src={
                            imagem
                          }
                          alt={`Questão ${questao.index}`}
                          className="w-full object-contain"
                        />
                      </div>
                    )
                  )}
                </div>
              )}

            {/* ALTERNATIVAS */}
            <div className="flex flex-col gap-4">
              {questao.alternatives.map(
                (alt) => {
                  const correta =
                    alt.letter ===
                    questao.correctAlternative;

                  const selecionada =
                    respostaUsuario ===
                    alt.letter;

                  let estilo =
                    "bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800/70";

                  // ERRADA
                  if (
                    respostaUsuario &&
                    selecionada &&
                    !correta
                  ) {
                    estilo =
                      "bg-red-500/10 border-red-500 text-red-300";
                  }

                  // CORRETA
                  if (
                    respostaUsuario &&
                    correta
                  ) {
                    estilo =
                      "bg-green-500/10 border-green-500 text-green-300";
                  }

                  return (
                    <button
                      key={
                        alt.letter
                      }
                      disabled={
                        !!respostaUsuario
                      }
                      onClick={() =>
                        responderQuestao(
                          questaoId,
                          alt.letter
                        )
                      }
                      className={`w-full text-left p-5 rounded-xl border transition-all duration-200 ${estilo}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-blue-400">
                          {
                            alt.letter
                          }
                          )
                        </span>

                        <span className="text-sm leading-6">
                          {
                            alt.text
                          }
                        </span>
                      </div>

                      {alt.file && (
                        <img
                          src={
                            alt.file
                          }
                          alt={`Alternativa ${alt.letter}`}
                          className="mt-4 rounded-lg border border-gray-700"
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>

            {/* RESULTADO */}
            {respostaUsuario && (
              <div className="mt-6 pt-5 border-t border-gray-800">
                {respostaUsuario ===
                questao.correctAlternative ? (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm font-semibold">
                    ✅ Você acertou a
                    questão.
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-semibold">
                    ❌ Você errou. A
                    resposta correta é{" "}
                    {
                      questao.correctAlternative
                    }
                    .
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default QuestoesEnem;
