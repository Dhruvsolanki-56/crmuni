export type ContactCandidates = {
  fullName: string;
  company: string;
  role: string;
  email: string;
  phone: string;
};

const roleWords =
  /\b(owner|founder|co-founder|chief|ceo|cfo|cto|coo|president|chairman|vice president|vp|director|manager|head|lead|engineer|consultant|sales|marketing|procurement|operations|officer|executive|specialist|designer|architect|photographer|artist|analyst|coordinator|advisor|adviser|freelancer|realtor|agent|broker|planner)\b/i;
const companyWords =
  /\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co\.?|group|industries|industry|systems|solutions|technologies|technology|pharma|labs|automation|engineering|studio|studios|design|designs|associates|partners|enterprises|ventures)\b/i;
const rejectNameWords =
  /\b(email|phone|mobile|tel|fax|website|www|address|scan|contact|company|limited|llc|inc|director|manager|head|sales|marketing|procurement|operations|visit|booth|follow|instagram|facebook|twitter|linkedin)\b/i;
const socialHandleWords = /\B@\w+/;

function cleanLine(value: string) {
  return value
    .replace(/[|•·]/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/^[^\p{L}\p{N}@+]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}

function titleCase(value: string) {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/\b\p{L}/gu, (character) => character.toUpperCase());
}

export function extractContactCandidates(text: string): ContactCandidates {
  const normalized = text.replace(/[‐‑‒–—]/g, '-');
  const lines = normalized
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 1);
  const emailPattern =
    /[A-Z0-9._%+-]+\s*[@]\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/gi;
  const emailCandidates = normalized.match(emailPattern) || [];
  const email =
    emailCandidates
      .map((candidate) => candidate.replace(/\s/g, '').toLowerCase())
      .find((candidate) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate)) ||
    '';
  const phoneCandidates = normalized.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const phone =
    phoneCandidates
      .map((candidate) => cleanLine(candidate))
      .find((candidate) => candidate.replace(/\D/g, '').length >= 8) || '';
  const isContactDetail = (line: string) =>
    line.includes('@') ||
    /https?:|www\.|\d{3}/i.test(line) ||
    socialHandleWords.test(line);
  const role =
    lines.find((line) => !isContactDetail(line) && roleWords.test(line)) ||
    '';
  const company =
    lines.find(
      (line) =>
        line !== role && !isContactDetail(line) && companyWords.test(line),
    ) || '';
  const isNameShaped = (line: string, maxWords: number) => {
    const words = line.split(' ').filter(Boolean);
    return (
      words.length >= 1 &&
      words.length <= maxWords &&
      words.every((word) => /^[\p{L}][\p{L}.'-]*$/u.test(word))
    );
  };
  const isNameCandidate = (line: string) =>
    line !== role &&
    line !== company &&
    !isContactDetail(line) &&
    !rejectNameWords.test(line);
  const fullName =
    lines.find(
      (line) =>
        isNameCandidate(line) &&
        (() => {
          const words = line.split(' ').filter(Boolean);
          return words.length >= 2 && isNameShaped(line, 5);
        })(),
    ) ||
    // Fall back to a single well-formed capitalized line (common when OCR
    // merges a first/last name onto separate lines or drops a space).
    lines.find(
      (line) =>
        isNameCandidate(line) &&
        isNameShaped(line, 4) &&
        /[\p{Lu}]/u.test(line[0] ?? ''),
    ) ||
    '';

  return {
    fullName: titleCase(fullName).slice(0, 120),
    company: titleCase(company).slice(0, 160),
    role: titleCase(role).slice(0, 120),
    email: email.slice(0, 254),
    phone: phone.slice(0, 40),
  };
}

export function extractEncodedContact(payload: string): ContactCandidates {
  const unfolded = payload.replace(/\r?\n[ \t]/g, '');
  const field = (names: string[]) => {
    for (const name of names) {
      const match = unfolded.match(
        new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'),
      );
      if (match?.[1]) return match[1].replace(/\\n/g, ' ').trim();
    }
    return '';
  };
  if (/BEGIN:VCARD/i.test(unfolded)) {
    const formattedName = field(['FN']);
    const structuredName = field(['N'])
      .split(';')
      .filter(Boolean)
      .reverse()
      .join(' ');
    return {
      fullName: (formattedName || structuredName).slice(0, 120),
      company: field(['ORG']).replaceAll(';', ' ').slice(0, 160),
      role: field(['TITLE', 'ROLE']).slice(0, 120),
      email: field(['EMAIL']).toLowerCase().slice(0, 254),
      phone: field(['TEL']).slice(0, 40),
    };
  }
  if (/^MECARD:/i.test(unfolded)) {
    const read = (name: string) =>
      unfolded.match(new RegExp(`(?:^|;)${name}:([^;]+)`, 'i'))?.[1]?.trim() ||
      '';
    return {
      fullName: read('N').split(',').reverse().join(' ').trim().slice(0, 120),
      company: read('ORG').slice(0, 160),
      role: read('TITLE').slice(0, 120),
      email: read('EMAIL').toLowerCase().slice(0, 254),
      phone: read('TEL').slice(0, 40),
    };
  }
  return extractContactCandidates(payload);
}

export function mergeContactCandidates(
  preferred: ContactCandidates,
  fallback: ContactCandidates,
): ContactCandidates {
  return {
    fullName: preferred.fullName || fallback.fullName,
    company: preferred.company || fallback.company,
    role: preferred.role || fallback.role,
    email: preferred.email || fallback.email,
    phone: preferred.phone || fallback.phone,
  };
}
