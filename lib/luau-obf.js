// lib/luau-obf.js
// Luau obfuscator - ultra-enhanced: base64 string encoding with preservation + pack option + advanced junk-code injection + one-line output + signature comment + number obfuscation + control flow flattening + anti-debug tricks
// Heuristic (not full parser). Use for research / protecting legitimate code.

const SAFE_NAMES = new Set([
  'workspace', 'game', 'script', 'wait', 'task', 'require', 'print', 'warn', 'error',
  'pairs', 'ipairs', 'next', 'type', 'typeof', 'Vector3', 'CFrame', 'Instance',
  'tonumber', 'tostring', 'math', 'string', 'table', 'Enum', 'GetService', 'FindFirstChild',
  'load', 'loadstring', 'pcall', 'xpcall', 'LocalPlayer', 'Players', 'ReplicatedStorage',
  'ServerStorage', 'ServerScriptService', 'Lighting', 'StarterGui', 'StarterPlayer',
  'StarterPack', 'SoundService', 'Chat', 'Teams', 'MarketplaceService', 'HttpService',
  'RunService', 'UserInputService', 'ContextActionService', 'GuiService', 'HapticService',
  'PhysicsService', 'TeleportService', 'TweenService', 'Debris', 'GetChildren',
  'WaitForChild', 'FindFirstChildOfClass', 'IsA', 'new', 'one', 'zero', 'Humanoid',
  'Part', 'Model', 'Tool', 'RemoteEvent', 'RemoteFunction', 'BindableEvent', 'BindableFunction',
  'BrickColor', 'Color3', 'UDim2', 'Vector2', 'Ray', 'Region3', 'TweenInfo', 'EasingStyle',
  'EasingDirection', 'Heartbeat', 'Stepped', 'RenderStepped', 'DescendantAdded', 'ChildAdded',
  'AncestryChanged', 'Changed', 'Destroying'
]);

const PRESERVED_STRINGS = new Set([
  'Players', 'Workspace', 'Lighting', 'ReplicatedStorage', 'ServerStorage',
  'ServerScriptService', 'StarterGui', 'StarterPlayer', 'StarterPack', 'SoundService',
  'Chat', 'Teams', 'MarketplaceService', 'HttpService', 'RunService', 'UserInputService',
  'ContextActionService', 'GuiService', 'HapticService', 'PhysicsService',
  'TeleportService', 'TweenService', 'Debris', 'Humanoid', 'Part', 'Model', 'Tool',
  'RemoteEvent', 'RemoteFunction', 'BindableEvent', 'BindableFunction'
]);

function genName(i) {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[i % letters.length];
  const b = Math.floor(i / letters.length);
  return '_' + a + b;
}

function collectLocals(src) {
  const names = new Set();
  // Collect local variables
  const localListRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
  let m;
  while ((m = localListRE.exec(src)) !== null) {
    const list = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of list) {
      if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
    }
  }
  // Collect local functions
  const localFuncRE = /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = localFuncRE.exec(src)) !== null) {
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
  // Collect local = function
  const localAssignFuncRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*function\b/g;
  while ((m = localAssignFuncRE.exec(src)) !== null) {
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
  // Collect function parameters
  const funcParamRE = /function\s*(?:[A-Za-z_][A-Za-z0-9_]*)?\s*\(([^)]*)\)/g;
  while ((m = funcParamRE.exec(src)) !== null) {
    const params = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of params) {
      if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
    }
  }
  return Array.from(names);
}

function buildMapping(names) {
  const map = Object.create(null);
  for (let i = 0; i < names.length; i++) {
    map[names[i]] = genName(i + 1);
  }
  return map;
}

function replaceIdents(src, mapping, preserveList = []) {
  const preserve = new Set(preserveList);
  const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (preserve.has(k)) continue;
    const re = new RegExp('\\b' + k + '\\b', 'g');
    src = src.replace(re, mapping[k]);
  }
  return src;
}

// encode strings > threshold into __B("base64") calls, but preserve important strings
function encodeStringsBase64(src, threshold = 3) {
  return src.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, (raw) => {
    const inner = raw.slice(1, -1);
    if (PRESERVED_STRINGS.has(inner) || inner.length <= threshold) return raw;
    const b64 = Buffer.from(inner, 'utf8').toString('base64');
    return `__B("${b64}")`;
  });
}

// Obfuscate numbers by replacing with expressions
function obfuscateNumbers(src) {
  return src.replace(/\b(\d+)\b/g, (match, num) => {
    num = parseInt(num);
    if (num === 0) return '0';
    if (num === 1) return '1';
    const ops = ['(2+3-5)', '(10-9)', '(5*2-9)', '(math.pi - 2.1415926535)', '(#("abc")-2)'];
    const randOp = ops[Math.floor(Math.random() * ops.length)];
    return randOp.replace(/^\d+$/, num); // Simple replacement, enhance as needed
  });
}

// Basic control flow flattening: insert fake if-else with junk
function flattenControlFlow(src, level = 1) {
  if (level < 1) return src;
  const lines = src.split('\n');
  for (let i = lines.length - 1; i > 0; i--) {
    if (Math.random() < 0.1 * level) { // 10% chance per line per level
      const junkIf = `if (false) then print("debug") end `;
      lines[i] = junkIf + lines[i];
    }
  }
  return lines.join('\n');
}

// Add anti-debug: insert code that detects debuggers (simple, for Luau)
function addAntiDebug(src) {
  const anti = `
local _dbg = getfenv or debug.getfenv
if _dbg then
  if type(_dbg) == 'function' then
    -- anti-debug detected
    while true do end -- infinite loop if debugged
  end
end
`;
  return anti + '\n' + src;
}

const LUA_BASE64_DECODER = `-- injected base64 decoder (enhanced)
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
    local v1 = bit32.bor(bit32.lshift(a, 2), bit32.rshift(c, 4))
    local v2 = bit32.bor(bit32.lshift(bit32.band(c, 15), 4), bit32.rshift(d, 2))
    local v3 = bit32.bor(bit32.lshift(bit32.band(d, 3), 6), e)
    table.insert(out, string.char(v1))
    if string.sub(s,i+2,i+2) ~= '=' then table.insert(out, string.char(v2)) end
    if string.sub(s,i+3,i+3) ~= '=' then table.insert(out, string.char(v3)) end
    i = i + 4
  end
  return table.concat(out)
end
`;

// advanced minify
function minify(src) {
  src = src.replace(/--\[\[[\s\S]*?\]\]/g, ''); // long comments
  src = src.replace(/--[^\n\r]*/g, ''); // line comments
  src = src.replace(/\n\s*\n+/g, '\n');
  src = src.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
  src = src.replace(/\s+/g, ' '); // collapse spaces
  src = src.replace(/([=+\-*\/><])( )([=+\-*\/><])/g, '$1$3'); // remove spaces around operators
  return src.trim();
}

/* ============= Ultra-Advanced Junk code generator =============
   More patterns, nested, randomized.
*/
function generateJunk(count = 20, level = 5, startIndex = 1000) {
  const patterns = [];
  let idx = startIndex;
  function nextName() { return '_j' + (idx++); }
  for (let i = 0; i < count; i++) {
    const a = nextName();
    const b = nextName();
    const c = nextName();
    const d = nextName();
    const e = nextName();
    const pat = Math.floor(Math.random() * 15); // More patterns
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
    } else if (pat === 5) {
      block += `local ${a} = {} local ${b} = 0 for i=1,0 do ${a}[i] = i end\n`;
    } else if (pat === 6) {
      block += `local ${a} = "" if (false) then ${a} = ${a} .. "junk" end\n`;
    } else if (pat === 7) {
      block += `local ${a} = {} for _=1,0 do table.insert(${a}, 1) end\n`;
    } else if (pat === 8) {
      block += `local ${a} = math.pi * 0 + 1 - 1\n`;
    } else if (pat === 9) {
      block += `local function ${a}() return end\n local ${b} = ${a}()\n`;
    } else if (pat === 10) {
      block += `local ${a} = function() if true then return else return end end\n`;
    } else if (pat === 11) {
      block += `local ${a} = 1 local ${b} = (${a} == 1 and 2 or 3)\n`;
    } else if (pat === 12) {
      block += `local ${a} = {} ${a}[${nextName()}] = nil\n`;
    } else if (pat === 13) {
      block += `if (not true) then local ${a} = 1 end\n`;
    } else if (pat === 14) {
      block += `local ${a} = select("#", ...) + 0\n`;
    }
    if (level >= 2) {
      block += `local function ${d}() local ${c} = 0 if (0==1) then ${c} = ${c}+1 end end\n`;
    }
    if (level >= 3) {
      block += `do local ${e} = function() return false end if ${e}() then end end\n`;
    }
    if (level >= 4) {
      block += `if (false) then local ${c} = function() end ${c}() end\n`;
    }
    if (level >= 5) {
      block += `local ${c} = {} table.sort(${c}, function(x,y) return x < y end)\n`;
    }
    block += '-- junk block end\n\n';
    patterns.push(block);
  }
  // Shuffle and nest some
  patterns.sort(() => Math.random() - 0.5);
  return patterns.join('');
}

/**
 * obfuscate(src, options)
 * Enhanced options:
 *  - threshold: minimal string length to encode (default 3)
 *  - preserve: array of names to preserve
 *  - pack: boolean, if true => encode ENTIRE output and wrap with loader
 *  - junkCount: number of junk blocks to inject (default 20)
 *  - junkLevel: complexity level of junk (1..5, default 5)
 *  - oneLine: boolean, if true produce one single-line output
 *  - encodeStrings: boolean, if false, skip base64 encoding of strings (default true)
 *  - obfuscateNums: boolean, obfuscate numbers (default true)
 *  - flattenLevel: control flow flattening level (0-5, default 2)
 *  - antiDebug: boolean, add anti-debug code (default true)
 *  - signature: boolean, if true add --[[obfuscator by luex]] (default true)
 */
function obfuscate(src, options = {}) {
  options = Object.assign({
    threshold: 3,
    preserve: [],
    pack: false,
    junkCount: 20,
    junkLevel: 5,
    oneLine: false,
    encodeStrings: true,
    obfuscateNums: true,
    flattenLevel: 2,
    antiDebug: true,
    signature: true
  }, options);
  let s = src;
  s = minify(s);
  const names = collectLocals(s);
  const mapping = buildMapping(names);
  if (options.encodeStrings) {
    s = encodeStringsBase64(s, options.threshold);
  }
  if (options.obfuscateNums) {
    s = obfuscateNumbers(s);
  }
  s = replaceIdents(s, mapping, options.preserve);
  s = flattenControlFlow(s, options.flattenLevel);

  // inject decoder only if used
  let final = s;
  let needDecoder = final.includes('__B("');

  // generate junk and interleave it
  if (options.junkCount && options.junkCount > 0) {
    const junk = generateJunk(options.junkCount, options.junkLevel, 2000);
    final = junk + '\n' + final;
  }

  if (options.antiDebug) {
    final = addAntiDebug(final);
  }

  if (needDecoder) {
    final = LUA_BASE64_DECODER + '\n' + final;
  }

  // Add signature
  if (options.signature) {
    final = '--[[obfuscator by luex]]\n' + final;
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
    local v1 = bit32.bor(bit32.lshift(a, 2), bit32.rshift(c, 4))
    local v2 = bit32.bor(bit32.lshift(bit32.band(c, 15), 4), bit32.rshift(d, 2))
    local v3 = bit32.bor(bit32.lshift(bit32.band(d, 3), 6), e)
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

  // final one-line option
  if (options.oneLine) {
    final = final.replace(/\r\n|\n/g, ' ');
    final = final.replace(/[ \t]{2,}/g, ' ');
    final = final.trim();
  }

  return { code: final, map: mapping };
}

module.exports = { obfuscate };
