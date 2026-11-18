import type { JsonDiffEntry, JsonValueType } from '../domain/types';

export function detectJsonType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'object') return 'object';
  return 'null';
}

export function defaultForType(type: JsonValueType): unknown {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    case 'null':
      return null;
  }
}

export function convertJsonType(current: unknown, targetType: JsonValueType): unknown {
  const currentType = detectJsonType(current);
  if (currentType === targetType) return current;

  switch (targetType) {
    case 'string':
      if (current === null || current === undefined) return '';
      if (typeof current === 'object') return JSON.stringify(current);
      return String(current);
    case 'number': {
      if (typeof current === 'boolean') return current ? 1 : 0;
      if (typeof current === 'string') {
        const parsed = Number(current.trim());
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    }
    case 'boolean':
      if (typeof current === 'string') {
        const norm = current.trim().toLowerCase();
        return norm === 'true' || norm === '1' || norm === 'yes';
      }
      if (typeof current === 'number') return current !== 0;
      return Boolean(current);
    case 'object':
      if (Array.isArray(current)) {
        const obj: Record<string, unknown> = {};
        current.forEach((item, idx) => {
          obj[`item_${idx}`] = item;
        });
        return obj;
      }
      if (current !== null && typeof current !== 'object') {
        return { value: current };
      }
      return {};
    case 'array':
      if (current === null) return [];
      if (typeof current === 'object' && !Array.isArray(current)) {
        return Object.values(current as Record<string, unknown>);
      }
      return [current];
    case 'null':
      return null;
  }
}

export function deepCloneJson<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneJson(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepCloneJson(v);
  }
  return out as T;
}

export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      if (key !== keysB[i]) return false;
      if (
        !deepEqualJson(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      ) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function summarizeVal(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 48 ? `"${v.slice(0, 45)}..."` : `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return `{${Object.keys(v as object).length} keys}`;
  return String(v);
}

export function computeJsonDiff(
  original: unknown,
  edited: unknown,
  prefix = ''
): JsonDiffEntry[] {
  const diffs: JsonDiffEntry[] = [];
  const origType = detectJsonType(original);
  const editType = detectJsonType(edited);

  if (origType !== editType) {
    diffs.push({
      kind: 'modified',
      path: prefix || '(root)',
      oldValue: summarizeVal(original),
      newValue: summarizeVal(edited),
    });
    return diffs;
  }

  if (origType === 'object') {
    const oObj = original as Record<string, unknown>;
    const eObj = edited as Record<string, unknown>;
    const origKeys = Object.keys(oObj);
    const editKeys = Object.keys(eObj);

    for (const k of origKeys) {
      const nextPath = prefix ? `${prefix}.${k}` : k;
      if (!(k in eObj)) {
        diffs.push({
          kind: 'removed',
          path: nextPath,
          oldValue: summarizeVal(oObj[k]),
        });
      } else {
        diffs.push(...computeJsonDiff(oObj[k], eObj[k], nextPath));
      }
    }
    for (const k of editKeys) {
      if (!(k in oObj)) {
        const nextPath = prefix ? `${prefix}.${k}` : k;
        diffs.push({
          kind: 'added',
          path: nextPath,
          newValue: summarizeVal(eObj[k]),
        });
      }
    }
    return diffs;
  }

  if (origType === 'array') {
    const oArr = original as unknown[];
    const eArr = edited as unknown[];
    const maxLen = Math.max(oArr.length, eArr.length);
    for (let i = 0; i < maxLen; i++) {
      const nextPath = `${prefix}[${i}]`;
      if (i >= oArr.length) {
        diffs.push({
          kind: 'added',
          path: nextPath,
          newValue: summarizeVal(eArr[i]),
        });
      } else if (i >= eArr.length) {
        diffs.push({
          kind: 'removed',
          path: nextPath,
          oldValue: summarizeVal(oArr[i]),
        });
      } else {
        diffs.push(...computeJsonDiff(oArr[i], eArr[i], nextPath));
      }
    }
    return diffs;
  }

  if (original !== edited) {
    diffs.push({
      kind: 'modified',
      path: prefix || '(root)',
      oldValue: summarizeVal(original),
      newValue: summarizeVal(edited),
    });
  }

  return diffs;
}

export function extractLogoUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;

  const directKeys = ['logoUrl', 'iconUrl', 'logo', 'icon', 'appLogo'];
  for (const key of directKeys) {
    if (typeof obj[key] === 'string' && /^https?:\/\//i.test(obj[key] as string)) {
      return obj[key] as string;
    }
  }
  if (obj.app && typeof obj.app === 'object' && !Array.isArray(obj.app)) {
    const appObj = obj.app as Record<string, unknown>;
    for (const key of directKeys) {
      if (typeof appObj[key] === 'string' && /^https?:\/\//i.test(appObj[key] as string)) {
        return appObj[key] as string;
      }
    }
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ConfigTemplate {
  id: string;
  label: string;
  description: string;
  data: Record<string, unknown>;
}

export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'remote-update',
    label: 'Remote App Update',
    description: 'Standard target app identity, version check, and update dialog keys.',
    data: {
      app: {
        name: 'Target Application',
        packageName: 'com.example.targetapp',
        logoUrl: 'https://example.com/logo.png',
      },
      update: {
        enabled: true,
        versionCode: 256,
        versionName: '2.5.6',
        title: 'New Update Available',
        message: 'A new version is available with performance improvements.',
        updateButtonText: 'Update Now',
        cancelButtonText: 'Later',
        forceUpdate: false,
        downloadUrl: 'https://example.com/app.apk',
      },
    },
  },
  {
    id: 'full-suite',
    label: 'Full Release & Maintenance',
    description: 'Includes app metadata, update, changelog, maintenance mode, and compatibility bounds.',
    data: {
      app: {
        name: 'Target Application',
        packageName: 'com.example.targetapp',
        logoUrl: 'https://example.com/logo.png',
      },
      update: {
        enabled: true,
        versionCode: 256,
        versionName: '2.5.6',
        title: 'New Update Available',
        message: 'A new version is available.',
        updateButtonText: 'Update Now',
        cancelButtonText: 'Later',
        forceUpdate: false,
        downloadUrl: 'https://example.com/app.apk',
      },
      changelog: {
        enabled: true,
        title: "What's New",
        items: ['Improved performance', 'Fixed download issues', 'Updated Material 3 UI'],
      },
      maintenance: {
        enabled: false,
        title: 'Scheduled Maintenance',
        message: 'Service will return shortly. Please try again later.',
      },
      compatibility: {
        minimumVersionCode: 250,
        recommendedVersionCode: 256,
      },
    },
  },
  {
    id: 'blank',
    label: 'Empty Object',
    description: 'Start with a clean empty configuration object and add custom keys.',
    data: {},
  },
];
