// lib/luau-obf.js
// Luau obfuscator - improved: base64 string encoding + pack option + junk-code injection + one-line output
// Heuristic (not full parser). Use for research / protecting legitimate code.

const SAFE_NAMES = new Set([
  'workspace','game','script','wait','task','require','print','warn','error',
  'pairs','ipairs','next','type','typeof','Vector3','CFrame','Instance',
  'tonumber','tostring','math','string','table','Enum','GetService','FindFirstChild',
  'load','loadstring','pcall','xpcall'
]);

function genName(i){
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const a = letters[i % letters.length];
  const b = Math.floor(i / letters.length);
  return '_' + a + b;
}

function collectLocals(src){
  const names = new Set();
  const localListRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
  let m;
  while ((m = localListRE.exec(src)) !== null){
    const list = m[1].split(',').map(s=>s.trim()).filter(Boolean);
    for (const n of list){
      if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
    }
  }
  const localFuncRE = /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = localFuncRE.exec(src)) !== null){
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
  const localAssignFuncRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*function\b/g;
  while ((m = localAssignFuncRE.exec(src)) !== null){
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
  return Array.from(names);
}

function buildMapping(names){
  const map = Object.create(null);
  for (let i=0;i<names.length;i++){
    map[names[i]] = genName(i+1);
  }
  return map;
}

function replaceIdents(src, mapping, preserveList = []){
  const preserve = new Set(preserveList);
  const keys = Object.keys(mapping).sort((a,b)=>b.length-a.length);
  for (const k of keys){
    if (preserve.has(k)) continue;
    const v = mapping[k];
    const re = new RegExp('\\b' + k + '\\b', 'g');
    src = src.replace(re, v);
  }
  return src;
}

// encode strings > threshold into __B("base64") calls
function encodeStringsBase64(src, threshold = 3){
  return src.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, (raw) => {
    const inner = raw.slice(1, -1);
    if (inner.length <= threshold) return raw;
    const b64 = Buffer.from(inner, 'utf8').toString('base64');
    return `__B("${b64}")`;
  });
}

const LUA_BASE64_DECODER = `-- injected base64 decoder (small)
local function __B(b)
  local bchars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local t = {}
  for i=1,#bchars do t[string.sub(bchars,i,i)] = i-1 end
  local s = b:gsub('[^'..bchars..'=]','')
  local out = {}
  local i = 1
  while i <= #s do
    local a = t[string.sub(s,i,i)] or 0
    local c = t[string.sub(s,i+1,i+1)] or 0
    local d = t[string.sub(s,i+2,i+2)] or 0
    local e = t[string.sub(s,i+3,i+3)] or 0
    local v1 = a*4 + math.floor(c/16)
    local v2 = (c%16)*16 + math.floor(d/4)
    local v3 = (d%4)*64 + e
    table.insert(out, string.char(v1))
    if string.sub(s,i+2,i+2) ~= '=' then table.insert(out, string.char(v2)) end
    if string.sub(s,i+3,i+3) ~= '=' then table.insert(out, string.char(v3)) end
    i = i + 4
  end
  return table.concat(out)
end
`;

// basic minify
function minify(src){
  src = src.replace(/--\[\[[\s\S]*?\]\]/g, ''); // long comments
  src = src.replace(/--[^\n\r]*/g, ''); // line comments
  src = src.replace(/\n\s*\n+/g, '\n');
  src = src.split('\n').map(l=>l.replace(/\s+$/,'')).join('\n');
  return src;
}

/* ============= Junk code generator =============
   Creates harmless local-only junk blocks that:
   - use only local names (unique)
   - contain unreachable branches or no-op returns
   - don't call global APIs or mutate environment
*/
function generateJunk(count = 6, level = 2, startIndex = 1000) {
  const patterns = [];
  let idx = startIndex;
  function nextName(){ return '_j' + (idx++); }
  for (let i=0;i<count;i++){
    const a = nextName();
    const b = nextName();
    const c = nextName();
    const d = nextName();
    const pat = i % 6;
    let block = '-- junk block start\n';
    if (pat === 0) {
      block += `local ${a} = {1,2,3}\nfor i=${a}[1],0 do ${b} = ${a}[1] end\n`;
    } else if (pat === 1) {
      block += `local ${a} = 0\nif (1==0) then ${a} = ${a} + 1 end\n`;
    } else if (pat === 2) {
      block += `local function ${a}(${b}) local ${c} = ${b} return ${c} end\n`;
    } else if (pat === 3) {
      block += `local ${a} = (2*3 - 6)\nlocal ${b} = (${a} + 0)\n`;
    } else if (pat === 4) {
      block += `local ${a} = "x"\nif (#${a} == 99) then local ${b} = ${a} .. "y" end\n`;
    } else {
      block += `local ${a} = {} local ${b} = 0 for i=1,0 do ${a}[i] = i end\n`;
    }
    if (level >= 3) {
      block += `local function ${d}() local ${c} = 0 if (0==1) then ${c} = ${c}+1 end end\n`;
    }
    block += '-- junk block end\n\n';
    patterns.push(block);
  }
  return patterns.join('');
}

/**
 * obfuscate(src, options)
 * options:
 *  - threshold: minimal string length to encode (default 3)
 *  - preserve: array of names to preserve
 *  - pack: boolean, if true => encode ENTIRE output and wrap with loader
 *  - junkCount: number of junk blocks to inject (default 6)
 *  - junkLevel: complexity level of junk (1..5)
 *  - oneLine: boolean, if true produce one single-line output (no newlines) to increase confusion
 */
function obfuscate(src, options = {}) {
  options = Object.assign({ threshold: 3, preserve: [], pack: false, junkCount: 6, junkLevel: 2, oneLine: false }, options);
  let s = src;
  s = minify(s);
  const names = collectLocals(s);
  const mapping = buildMapping(names);
  s = encodeStringsBase64(s, options.threshold);
  s = replaceIdents(s, mapping, options.preserve || []);

  // inject decoder only if used
  let final = s;
  let needDecoder = final.includes('__B("');

  // generate junk and prepend it (safe: only local names inside)
  if (options.junkCount && options.junkCount > 0) {
    const junk = generateJunk(options.junkCount, options.junkLevel, 2000);
    final = junk + '\n' + final;
  }

  if (needDecoder) {
    final = LUA_BASE64_DECODER + '\n' + final;
  }

  if (options.pack) {
    // pack entire script: base64-encode 'final' and output loader
    const b64 = Buffer.from(final, 'utf8').toString('base64');
    const loader = `
-- pack-loader injected by obfuscator
local function __B_main(b)
  local bchars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local t = {}
  for i=1,#bchars do t[string.sub(bchars,i,i)] = i-1 end
  local s = b:gsub('[^'..bchars..'=]','')
  local out = {}
  local i = 1
  while i <= #s do
    local a = t[string.sub(s,i,i)] or 0
    local c = t[string.sub(s,i+1,i+1)] or 0
    local d = t[string.sub(s,i+2,i+2)] or 0
    local e = t[string.sub(s,i+3,i+3)] or 0
    local v1 = a*4 + math.floor(c/16)
    local v2 = (c%16)*16 + math.floor(d/4)
    local v3 = (d%4)*64 + e
    table.insert(out, string.char(v1))
    if string.sub(s,i+2,i+2) ~= '=' then table.insert(out, string.char(v2)) end
    if string.sub(s,i+3,i+3) ~= '=' then table.insert(out, string.char(v3)) end
    i = i + 4
  end
  return table.concat(out)
end

local _packed = __B_main("${b64}")
local loader = loadstring or load
if loader then
  local fn, err = loader(_packed)
  if fn then
    pcall(fn)
  else
    error('loader error: '..tostring(err))
  end
else
  error('no load/loadstring available')
end
`;
    final = loader;
  }

  // final one-line option (safe because strings were encoded earlier)
  if (options.oneLine) {
    // replace newlines with single space but preserve readability of tokens
    final = final.replace(/\r\n|\n/g, ' ');
    // collapse multiple spaces
    final = final.replace(/[ \t]{2,}/g, ' ');
    final = final.trim();
  }

  return { code: final, map: mapping };
}

module.exports = { obfuscate };
