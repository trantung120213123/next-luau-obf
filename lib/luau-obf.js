// lib/luau-obf.js
// Luau obfuscator - moonsec-inspired: advanced base64 string encoding with preservation + pack option + hidden junk-code injection + one-line output + no visible comments + number obfuscation + control flow flattening + anti-debug tricks + anti-tamper protection
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
  const localListRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
  let m;
  while ((m = localListRE.exec(src)) !== null) {
    const list = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of list) {
      if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
    }
  }
  const localFuncRE = /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = localFuncRE.exec(src)) !== null) {
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
  const localAssignFuncRE = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*function\b/g;
  while ((m = localAssignFuncRE.exec(src)) !== null) {
    const n = m[1];
    if (n.length >= 2 && !SAFE_NAMES.has(n)) names.add(n);
  }
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

function encodeStringsBase64(src, threshold = 3) {
  return src.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, (raw) => {
    const inner = raw.slice(1, -1);
    if (PRESERVED_STRINGS.has(inner) || inner.length <= threshold) return raw;
    const b64 = Buffer.from(inner, 'utf8').toString('base64');
    return `__B("${b64}")`;
  });
}

function obfuscateNumbers(src) {
  return src.replace(/\b(\d+)\b/g, (match, num) => {
    num = parseInt(num);
    if (num === 0) return '(1-1)';
    if (num === 1) return '(2-1)';
    const ops = [
      `((${num}+1)-1)`,
      `(math.floor(${num * 2}/2))`,
      `(bit32.band(${num}, ${num}))`,
      `(${num} + (1-1))`,
      `(select(1, ${num}))`
    ];
    return ops[Math.floor(Math.random() * ops.length)];
  });
}

function flattenControlFlow(src, level = 3) {
  if (level < 1) return src;
  const lines = src.split('\n');
  for (let i = lines.length - 1; i > 0; i--) {
    if (Math.random() < 0.15 * level) {
      const junkIf = `if (math.random() > 1) then else `;
      lines[i] = junkIf + lines[i] + ` end`;
    }
  }
  return lines.join('\n');
}

function addAntiDebug(src) {
  const anti = `
local _env = getfenv(0)
if _env.debug or debug.getinfo then
  while true do task.wait() end
end
`;
  return anti + '\n' + src;
}

function addAntiTamper(src) {
  // Simple checksum-based anti-tamper
  const checksumVar = genName(9999);
  const codeHash = Buffer.from(src).toString('base64').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
  const antiTamper = `
local ${checksumVar} = function() 
  local s = string.dump(loadstring or load)
  local h = 0
  for i=1,#s do h = h + string.byte(s, i) end
  return h % 256
end
if ${checksumVar}() ~= ${codeHash.charCodeAt(0) % 256} then 
  while true do end 
end
`;
  return antiTamper + '\n' + src;
}

const LUA_BASE64_DECODER = `local function __B(b)
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

function minify(src) {
  src = src.replace(/--\[\[[\s\S]*?\]\]/g, '');
  src = src.replace(/--[^\n\r]*/g, '');
  src = src.replace(/\n\s*\n+/g, '\n');
  src = src.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
  src = src.replace(/\s+/g, ' ');
  src = src.replace(/([=+\-*\/><])( )([=+\-*\/><])/g, '$1$3');
  return src.trim();
}

function generateJunk(count = 30, level = 5, startIndex = 1000) {
  const patterns = [];
  let idx = startIndex;
  function nextName() { return '_j' + (idx++); }
  for (let i = 0; i < count; i++) {
    const a = nextName();
    const b = nextName();
    const c = nextName();
    const d = nextName();
    const e = nextName();
    const pat = Math.floor(Math.random() * 20);
    let block = '';
    if (pat === 0) {
      block += `local ${a}={1,2,3}for i=${a}[1],0 do ${b}=${a}[1]end `;
    } else if (pat === 1) {
      block += `local ${a}=0 if(1==0)then ${a}=${a}+1 end `;
    } else if (pat === 2) {
      block += `local function ${a}(${b})local ${c}=${b}return ${c}end `;
    } else if (pat === 3) {
      block += `local ${a}=(2*3-6)local ${b}=(${a}+0) `;
    } else if (pat === 4) {
      block += `local ${a}="x"if(#${a}==99)then local ${b}=${a}.."y"end `;
    } else if (pat === 5) {
      block += `local ${a}={}local ${b}=0 for i=1,0 do ${a}[i]=i end `;
    } else if (pat === 6) {
      block += `local ${a}=""if(false)then ${a}=${a}.."junk"end `;
    } else if (pat === 7) {
      block += `local ${a}={}for _=1,0 do table.insert(${a},1)end `;
    } else if (pat === 8) {
      block += `local ${a}=math.pi*0+1-1 `;
    } else if (pat === 9) {
      block += `local function ${a}()return end local ${b}=${a}() `;
    } else if (pat === 10) {
      block += `local ${a}=function()if true then return else return end end `;
    } else if (pat === 11) {
      block += `local ${a}=1 local ${b}=(${a}==1 and 2 or 3) `;
    } else if (pat === 12) {
      block += `local ${a}={} ${a}[${nextName()}]=nil `;
    } else if (pat === 13) {
      block += `if(not true)then local ${a}=1 end `;
    } else if (pat === 14) {
      block += `local ${a}=select("#",...)+0 `;
    } else if (pat === 15) {
      block += `local ${a}=bit32.lshift(1,0) `;
    } else if (pat === 16) {
      block += `if(math.random()>1)then else end `;
    } else if (pat === 17) {
      block += `local ${a}=table.clone({}) `;
    } else if (pat === 18) {
      block += `for ${a}=1,0 do end `;
    } else if (pat === 19) {
      block += `repeat until true `;
    }
    if (level >= 2) {
      block += `local function ${d}()local ${c}=0 if(0==1)then ${c}=${c}+1 end end `;
    }
    if (level >= 3) {
      block += `do local ${e}=function()return false end if ${e}()then end end `;
    }
    if (level >= 4) {
      block += `if(false)then local ${c}=function()end ${c}()end `;
    }
    if (level >= 5) {
      block += `local ${c}={}table.sort(${c},function(x,y)return x<y end) `;
    }
    block += '\n';
    patterns.push(block);
  }
  patterns.sort(() => Math.random() - 0.5);
  return patterns.join('');
}

function obfuscate(src, options = {}) {
  options = Object.assign({
    threshold: 3,
    preserve: [],
    pack: true,
    junkCount: 30,
    junkLevel: 5,
    oneLine: true,
    encodeStrings: true,
    obfuscateNums: true,
    flattenLevel: 3,
    antiDebug: true,
    antiTamper: true,
    signature: false
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

  let final = s;
  let needDecoder = final.includes('__B("');

  if (options.junkCount && options.junkCount > 0) {
    const junk = generateJunk(options.junkCount, options.junkLevel, 2000);
    final = junk + final;
  }

  if (options.antiDebug) {
    final = addAntiDebug(final);
  }

  if (options.antiTamper) {
    final = addAntiTamper(final);
  }

  if (needDecoder) {
    final = LUA_BASE64_DECODER + final;
  }

  if (options.pack) {
    const b64 = Buffer.from(final, 'utf8').toString('base64');
    const loader = `local function __B_main(b)local bchars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'local t={}for i=1,#bchars do t[string.sub(bchars,i,i)]=i-1 end local s=b:gsub('[^'..bchars..'=]','')local out={}local i=1 while i<=#s do local a=t[string.sub(s,i,i)]or 0 local c=t[string.sub(s,i+1,i+1)]or 0 local d=t[string.sub(s,i+2,i+2)]or 0 local e=t[string.sub(s,i+3,i+3)]or 0 local v1=bit32.bor(bit32.lshift(a,2),bit32.rshift(c,4))local v2=bit32.bor(bit32.lshift(bit32.band(c,15),4),bit32.rshift(d,2))local v3=bit32.bor(bit32.lshift(bit32.band(d,3),6),e)table.insert(out,string.char(v1))if string.sub(s,i+2,i+2)~='='then table.insert(out,string.char(v2))end if string.sub(s,i+3,i+3)~='='then table.insert(out,string.char(v3))end i=i+4 end return table.concat(out)end local _packed=__B_main("${b64}")local loader=loadstring or load if loader then local fn,err=loader(_packed)if fn then pcall(fn)else error('loader error: '..tostring(err))end else error('no load/loadstring available')end `;
    final = loader;
  }

  if (options.oneLine) {
    final = final.replace(/\r\n|\n/g, ' ');
    final = final.replace(/[ \t]{2,}/g, ' ');
    final = final.trim();
  }

  return { code: final, map: mapping };
}

module.exports = { obfuscate };
