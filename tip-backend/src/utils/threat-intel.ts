type IOCRecordLike = {
  value: string;
  type: string;
  tags?: string[] | null;
  sources?: string[] | null;
  description?: string | null;
};

const ACTOR_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'APT28', pattern: /\b(apt28|fancy bear|sofacy|pawn storm)\b/i },
  { name: 'APT29', pattern: /\b(apt29|cozy bear|the dukes|nobelium)\b/i },
  { name: 'Lazarus Group', pattern: /\b(lazarus|hidden cobra)\b/i },
  { name: 'FIN7', pattern: /\b(fin7|carbanak)\b/i },
  { name: 'Sandworm', pattern: /\b(sandworm|voodoo bear)\b/i },
  { name: 'TA505', pattern: /\b(ta505)\b/i },
  { name: 'LockBit', pattern: /\b(lockbit)\b/i },
  { name: 'BlackCat/ALPHV', pattern: /\b(alphv|blackcat)\b/i },
  { name: 'Conti', pattern: /\b(conti)\b/i },
];

const SOURCE_TO_ACTOR: Record<string, string[]> = {
  'feodo tracker': ['TA505'],
  'malwarebazaar': ['TA505', 'Lazarus Group'],
  'threatfox': ['APT28', 'APT29', 'Lazarus Group'],
  urlhaus: ['TA505'],
};

const KEYWORD_TO_TECHNIQUES: Record<string, string[]> = {
  phishing: ['T1566'],
  spearphishing: ['T1566.001'],
  powershell: ['T1059.001'],
  commandline: ['T1059'],
  cmd: ['T1059.003'],
  script: ['T1059'],
  c2: ['T1071'],
  beacon: ['T1071'],
  exfiltration: ['T1041'],
  persistence: ['T1547'],
  credential: ['T1003'],
  dumping: ['T1003'],
  lateral: ['T1021'],
  rdp: ['T1021.001'],
  smb: ['T1021.002'],
  dns: ['T1071.004'],
  http: ['T1071.001'],
  https: ['T1071.001'],
  download: ['T1105'],
  payload: ['T1105'],
  exploit: ['T1203'],
  macro: ['T1204.002'],
  'drive-by': ['T1189'],
  registry: ['T1112'],
  scheduled: ['T1053'],
  service: ['T1543'],
  wmi: ['T1047'],
};

function normalizeIOCText(ioc: IOCRecordLike): string {
  return [
    ioc.value,
    ioc.type,
    ioc.description || '',
    ...(ioc.tags || []),
    ...(ioc.sources || []),
  ]
    .join(' ')
    .toLowerCase();
}

export function extractThreatActorsFromIOC(ioc: IOCRecordLike): string[] {
  const text = normalizeIOCText(ioc);
  const actors = new Set<string>();

  for (const entry of ACTOR_PATTERNS) {
    if (entry.pattern.test(text)) actors.add(entry.name);
  }

  for (const source of ioc.sources || []) {
    const normalized = source.toLowerCase();
    for (const [sourceKey, mappedActors] of Object.entries(SOURCE_TO_ACTOR)) {
      if (normalized.includes(sourceKey)) {
        for (const actor of mappedActors) actors.add(actor);
      }
    }
  }

  return Array.from(actors);
}

export function inferMitreTechniquesFromIOC(ioc: IOCRecordLike): string[] {
  const text = normalizeIOCText(ioc);
  const techniques = new Set<string>();

  const explicitTechniqueMatches = text.match(/\bt\d{4}(?:\.\d{3})?\b/gi) || [];
  for (const match of explicitTechniqueMatches) techniques.add(match.toUpperCase());

  for (const [keyword, ttpIds] of Object.entries(KEYWORD_TO_TECHNIQUES)) {
    if (text.includes(keyword)) {
      for (const id of ttpIds) techniques.add(id.toUpperCase());
    }
  }

  // IOC-type baseline mapping when no explicit signal exists.
  if (techniques.size === 0) {
    if (ioc.type === 'ip' || ioc.type === 'domain') {
      techniques.add('T1071');
    } else if (ioc.type === 'url') {
      techniques.add('T1566');
      techniques.add('T1071.001');
    } else if (ioc.type === 'hash') {
      techniques.add('T1204');
      techniques.add('T1105');
    } else if (ioc.type === 'email') {
      techniques.add('T1566');
    }
  }

  return Array.from(techniques);
}
