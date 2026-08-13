import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { columns, sampleRows, userQuery } = body;

    if (!columns || !sampleRows) {
      return NextResponse.json(
        { error: 'Parâmetros columns e sampleRows são obrigatórios.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // If user provided a specific question
    if (userQuery && userQuery.trim() !== '') {
      const prompt = `Você é um assistente especialista em análise e higienização de dados em planilhas Excel.
Estrutura das Colunas: ${JSON.stringify(columns)}
Amostra dos Dados (primeiras linhas): ${JSON.stringify(sampleRows.slice(0, 25))}

Sua tarefa: Responda de forma clara, direta e sucinta (em Português do Brasil) à seguinte dúvida do usuário sobre os dados:
"${userQuery}"

Importante: Não inclua gráficos nem markdown de tabelas pesadas. Responda com tópicos curtos, objetivos e práticos.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      return NextResponse.json({
        answer: response.text || 'Não foi possível gerar resposta para a sua dúvida.',
      });
    }

    // Default Quality & Suggestion Analysis with structured responseSchema
    const prompt = `Analise a qualidade desta planilha e identifique inconsistências de formatação, espaços em branco, CPFs/CNPJs sem formatação ou inválidos, datas misturadas e valores numéricos sem padrão.

Colunas: ${JSON.stringify(columns)}
Amostra de dados (primeiras 25 linhas): ${JSON.stringify(sampleRows.slice(0, 25))}

Forneça uma avaliação de qualidade de 0 a 100, um resumo em português e sugestões de regras acionáveis por coluna.
Para cada sugestão, identifique o ID exato da coluna e o tipo de regra sugerido:
- 'trim' (Espaços extras no início/fim)
- 'titlecase' (Nomes em caixa baixa ou alta misturados)
- 'uppercase' (Textos para caixa alta)
- 'lowercase' (Textos para caixa baixa)
- 'format_cpf' (CPFs brutos ou desformatados)
- 'format_cnpj' (CNPJs brutos)
- 'format_phone' (Telefones brutos)
- 'format_currency_brl' (Valores sem R$ ou misturados)
- 'convert_date' (Datas com barras, hífens ou formatos inconsistentes)
- 'fill_nulls' (Preencher campos vazios)
- 'remove_null_rows' (Remover linhas totalmente vazias nesta coluna)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: 'Nota de qualidade global de 0 a 100' },
            summaryText: { type: Type.STRING, description: 'Resumo conciso da saúde dos dados' },
            issuesCount: {
              type: Type.OBJECT,
              properties: {
                missing: { type: Type.NUMBER },
                invalidCpf: { type: Type.NUMBER },
                dateFormatMix: { type: Type.NUMBER },
                spaces: { type: Type.NUMBER },
              },
              required: ['missing', 'invalidCpf', 'dateFormatMix', 'spaces'],
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  columnId: { type: Type.STRING, description: 'O col.id correspondente e.g. col_0' },
                  columnName: { type: Type.STRING },
                  ruleType: {
                    type: Type.STRING,
                    description: 'Um dos tipos: trim, titlecase, uppercase, format_cpf, format_cnpj, format_phone, format_currency_brl, convert_date, fill_nulls',
                  },
                  confidence: { type: Type.STRING, description: 'high, medium ou low' },
                  issueType: { type: Type.STRING, description: 'formatting, invalid_data, missing_values ou standardization' },
                },
                required: ['id', 'title', 'description', 'columnId', 'columnName', 'ruleType', 'confidence', 'issueType'],
              },
            },
          },
          required: ['score', 'summaryText', 'issuesCount', 'suggestions'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const reportData = JSON.parse(text);

    return NextResponse.json(reportData);
  } catch (err: any) {
    console.error('Error in Gemini analysis route:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao comunicar com a IA.' },
      { status: 500 }
    );
  }
}
