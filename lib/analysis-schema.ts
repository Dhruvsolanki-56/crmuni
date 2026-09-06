export type ConversationAnalysis = {
  summary: string;
  fields: Array<{ key: string; label: string; value: string | null; confidence: number; evidence: string | null }>;
  commitments: Array<{ title: string; due_date: string | null; owner_party: string; confidence: number; evidence: string }>;
  score: { value: number; rationale: string };
  risks: string[];
};

export const conversationAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          key: { type: 'string' }, label: { type: 'string' }, value: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }, evidence: { type: ['string', 'null'] },
        },
        required: ['key', 'label', 'value', 'confidence', 'evidence'],
      },
    },
    commitments: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' }, due_date: { type: ['string', 'null'] }, owner_party: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }, evidence: { type: 'string' },
        },
        required: ['title', 'due_date', 'owner_party', 'confidence', 'evidence'],
      },
    },
    score: {
      type: 'object', additionalProperties: false,
      properties: { value: { type: 'integer', minimum: 0, maximum: 100 }, rationale: { type: 'string' } },
      required: ['value', 'rationale'],
    },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'fields', 'commitments', 'score', 'risks'],
} as const;
