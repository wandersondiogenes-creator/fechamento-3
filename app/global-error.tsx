'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-xl">
          <h2 className="text-xl font-bold mb-3 text-rose-400">Erro na Aplicação</h2>
          <p className="text-sm text-slate-400 mb-6">
            Ocorreu uma falha inesperada no carregamento do sistema.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Recarregar Aplicação
          </button>
        </div>
      </body>
    </html>
  );
}
