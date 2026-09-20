import type { ConversationAnalysis } from './analysis-schema';

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const nullableText = (value: unknown, max: number) => {
  if (value === null) return null;
  const cleaned = text(value, max);
  return cleaned || null;
};
const confidence = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
};

export function validateConversationAnalysis(
  value: unknown,
): ConversationAnalysis | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.fields) || !Array.isArray(input.commitments))
    return null;
  if (!input.score || typeof input.score !== 'object') return null;
  const scoreInput = input.score as Record<string, unknown>;
  const scoreValue = Number(scoreInput.value);
  const scoreRationale = text(scoreInput.rationale, 2000);
  if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100)
    return null;
  if (!scoreRationale) return null;

  const fields: ConversationAnalysis['fields'] = [];
  for (const candidate of input.fields.slice(0, 50)) {
    if (!candidate || typeof candidate !== 'object') return null;
    const field = candidate as Record<string, unknown>;
    const key = text(field.key, 80);
    const label = text(field.label, 120);
    const fieldConfidence = confidence(field.confidence);
    if (!key || !label || fieldConfidence === null) return null;
    fields.push({
      key,
      label,
      value: nullableText(field.value, 2000),
      confidence: fieldConfidence,
      evidence: nullableText(field.evidence, 1000),
    });
  }

  const commitments: ConversationAnalysis['commitments'] = [];
  for (const candidate of input.commitments.slice(0, 20)) {
    if (!candidate || typeof candidate !== 'object') return null;
    const commitment = candidate as Record<string, unknown>;
    const title = text(commitment.title, 240);
    const ownerParty = text(commitment.owner_party, 120);
    const evidence = text(commitment.evidence, 1000);
    const itemConfidence = confidence(commitment.confidence);
    if (!title || !ownerParty || !evidence || itemConfidence === null)
      return null;
    commitments.push({
      title,
      due_date: nullableText(commitment.due_date, 10),
      owner_party: ownerParty,
      confidence: itemConfidence,
      evidence,
    });
  }
  const risks = Array.isArray(input.risks)
    ? input.risks
        .map((item) => text(item, 500))
        .filter(Boolean)
        .slice(0, 30)
    : null;
  const summary = text(input.summary, 3000);
  if (!summary || !risks) return null;
  return {
    summary,
    fields,
    commitments,
    score: { value: scoreValue, rationale: scoreRationale },
    risks,
  };
}

export function groundConversationAnalysis(
  analysis: ConversationAnalysis,
  sourceNote: string,
) {
  const note = sourceNote.toLocaleLowerCase();
  return {
    ...analysis,
    fields: analysis.fields.map((field) => {
      const supported = Boolean(
        field.evidence && note.includes(field.evidence.toLocaleLowerCase()),
      );
      return supported
        ? field
        : { ...field, value: null, confidence: 0, evidence: null };
    }),
    commitments: analysis.commitments
      .filter(
        (item) =>
          item.evidence && note.includes(item.evidence.toLocaleLowerCase()),
      )
      .map((item) => ({
        ...item,
        due_date:
          item.due_date && /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)
            ? item.due_date
            : null,
      })),
  };
}
