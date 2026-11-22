/**
 * Models sometimes return almost-valid JSON: a raw line break inside a string,
 * an unescaped " inside Arabic text, or a trailing comma. repairJson() fixes those.
 */
function repairJson(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '\\') { out += ch + (text[i + 1] ?? ''); i += 1; continue; } // keep valid escapes
    if (ch === '\n') { out += '\\n'; continue; }
    if (ch === '\r') { continue; }
    if (ch === '\t') { out += '\\t'; continue; }
    if (ch === '"') {
      let next = i + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      if (next >= text.length || ',}]:'.includes(text[next])) { inString = false; out += ch; } // real closing quote
      else out += '\\"'; // quote inside the text
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1'); // trailing commas
}

/** Returns the parsed object, or throws the original parse error (with position) if nothing works. */
function parseJsonLoose(raw) {
  const text = String(raw || '');
  const fenceFree = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  const first = fenceFree.indexOf('{');
  const last = fenceFree.lastIndexOf('}');
  const core = first !== -1 && last > first ? fenceFree.slice(first, last + 1) : fenceFree;

  let firstError;
  for (const candidate of [core, repairJson(core)]) {
    try { return JSON.parse(candidate); } catch (error) { firstError = firstError || error; }
  }
  throw firstError;
}

module.exports = { repairJson, parseJsonLoose };
