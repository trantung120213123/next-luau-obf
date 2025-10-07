# Next Luau Obfuscator

Simple research-grade Luau obfuscator built with Next.js for Vercel.

Features:
- rename local variables & local function names (heuristic)
- encode string literals to base64 with runtime decoder
- optional pack (encode entire script and load at runtime)
- inject junk/dead code blocks (configurable)
- output one-line version (to increase confusion)
- returns mapping JSON for debugging

Usage:
1. Create project with files above.
2. `git init` + commit + push to GitHub.
3. Import project to Vercel -> Deploy.
4. Open page, paste code, chọn options -> Obfuscate -> Download.

**Warning:** Use for research / protecting code only. Do not use to bypass anti-cheat, distribute malware, or illegal activity.

