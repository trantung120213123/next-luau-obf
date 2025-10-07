// pages/index.js
import { useState } from 'react';

export default function Home(){
  const [code, setCode] = useState('');
  const [out, setOut] = useState('');
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(3);
  const [preserveText, setPreserveText] = useState('workspace,game,require');
  const [pack, setPack] = useState(false);
  const [junkCount, setJunkCount] = useState(6);
  const [junkLevel, setJunkLevel] = useState(2);
  const [oneLine, setOneLine] = useState(false);

  async function doObf(){
    setLoading(true);
    setOut(''); setMap(null);
    try {
      const preserve = preserveText.split(',').map(s=>s.trim()).filter(Boolean);
      const r = await fetch('/api/obf', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ code, threshold: Number(threshold), preserve, pack, junkCount: Number(junkCount), junkLevel: Number(junkLevel), oneLine })
      });
      const j = await r.json();
      if (r.ok) {
        setOut(j.obf);
        setMap(j.map);
      } else {
        alert(j.error || 'Error');
      }
    } catch (e) { console.error(e); alert('Network error'); }
    setLoading(false);
  }

  function downloadFile() {
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'obfuscated.lua';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{padding:20,fontFamily:'Inter,Segoe UI,Roboto,monospace'}}>
      <h2>Luau Obfuscator — Next.js (Research only)</h2>
      <p style={{color:'#666'}}>Dùng để nghiên cứu / bảo vệ mã. Không dùng cho hành vi trái pháp luật.</p>

      <div style={{display:'flex',gap:12}}>
        <textarea value={code} onChange={e=>setCode(e.target.value)} style={{width:'60%',height:520,padding:8,fontFamily:'monospace'}} placeholder="Dán code Luau/Roblox ở đây" />

        <div style={{width:'40%'}}>
          <div style={{marginBottom:10}}>
            <label>Threshold chuỗi (>= chars): </label>
            <input type="number" value={threshold} onChange={e=>setThreshold(e.target.value)} min={1} style={{width:80,marginLeft:8}} />
          </div>

          <div style={{marginBottom:10}}>
            <label>Preserve (phân tách bằng ,):</label><br/>
            <input style={{width:'100%'}} value={preserveText} onChange={e=>setPreserveText(e.target.value)} />
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
            <label><input type="checkbox" checked={pack} onChange={e=>setPack(e.target.checked)} /> Pack (encode toàn bộ + loader)</label>
            <label style={{marginLeft:8}}><input type="checkbox" checked={oneLine} onChange={e=>setOneLine(e.target.checked)} /> Xuất 1 dòng (one-line)</label>
          </div>

          <div style={{marginBottom:10}}>
            <label>Junk blocks:</label>
            <input type="number" min="0" value={junkCount} onChange={e=>setJunkCount(e.target.value)} style={{width:80,marginLeft:8}} />
            <label style={{marginLeft:10}}>Junk level:</label>
            <input type="number" min="1" max="5" value={junkLevel} onChange={e=>setJunkLevel(e.target.value)} style={{width:80,marginLeft:8}} />
          </div>

          <div style={{marginTop:8}}>
            <button onClick={doObf} disabled={loading} style={{padding:'8px 12px',fontWeight:700,marginRight:8}}>
              {loading ? 'Đang xử lý...' : 'Obfuscate'}
            </button>
            <button onClick={downloadFile} disabled={!out} style={{padding:'8px 12px'}}>Download</button>
          </div>

          <div style={{marginTop:12}}>
            <h4>Kết quả (obfuscated)</h4>
            <textarea value={out} readOnly style={{width:'100%',height:300,fontFamily:'monospace'}} />
          </div>

          <div style={{marginTop:10}}>
            <h4>Map (JSON)</h4>
            <pre style={{height:160,overflow:'auto',background:'#0b0b0b',color:'#9fdab0',padding:8}}>{map ? JSON.stringify(map, null, 2) : '—'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
