const fs = require('fs');
const file = 'components/FechamentoView.tsx';
let code = fs.readFileSync(file, 'utf8');

const flatViewCode = `        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Empresa</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-800">{item.empresa || 'Sem Empresa'}</td>
                    <td className="p-4 text-slate-600">{item.origem || 'Desconhecida'}</td>
                    <td className="p-4 text-slate-600 truncate max-w-xs">{item.descricao}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-700">{formatBRL(item.valor)}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">Nenhum lançamento encontrado para os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>`;

code = code.replace(
  '{/* Original flat view logic preserved, styled appropriately if needed */}\n        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">\n           {/* ... existing flat view ... */}\n           <div className="p-12 text-center text-slate-500 font-bold">\n             A visualização em lista plana foi preservada.\n           </div>\n        </div>',
  flatViewCode
);

fs.writeFileSync(file, code);
