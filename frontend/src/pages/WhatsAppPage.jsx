import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = API_ORIG.replace(/\/api$/, "");
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;

export default function WhatsAppPage() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [selectedClients, setSelectedClients] = useState([]);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function loadClients(){
    const res = await fetch(url('/api/clients'), { credentials:'include' });
    const json = await res.json();
    const arr = Array.isArray(json.data) ? json.data : json;
    setClients(Array.isArray(arr) ? arr : []);
  }
  useEffect(() => { loadClients().catch(()=>{}); }, []);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(url('/api/whatsapp/status'), { credentials:'include' });
        const data = await res.json();
        setStatus(data.state || data.connected ? 'connected' : 'Not connected');
      } catch { setStatus("Error"); }
    }
    fetchStatus();
    const i1 = setInterval(fetchStatus, 5000);
    return () => clearInterval(i1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async function loop(){
      try {
        const res = await fetch(url('/api/whatsapp/qr'), { credentials:'include' });
        if (res.status === 200) {
          const data = await res.json();
          if (data?.dataUrl) {
            if (!cancelled) setQrDataUrl(data.dataUrl);
          } else if (!data?.qr) { if (!cancelled) setQrDataUrl(null); }
        } else if (res.status === 204) { if (!cancelled) setQrDataUrl(null); }
      } catch {}
      if (!cancelled) setTimeout(loop, 3000);
    })();
    return ()=>{ cancelled = true; }
  }, []);

  // Defensive: some sheet parsers may include empty rows as null/undefined.
  const filtered = (Array.isArray(clients) ? clients : [])
    .filter((c) => c && typeof c === 'object')
    .filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(String(q || '').toLowerCase()) ||
        String(c.phone || '').includes(String(q || ''))
    );

  const toggle = (phone) =>
    setSelectedClients(prev => prev.includes(phone) ? prev.filter(p=>p!==phone) : [...prev, phone]);

  async function syncWA(){
    try { 
      await fetch(url('/api/whatsapp/sync/google-csv?mode=mirror'), { method:'POST' });
      await loadClients(); 
      alert('WhatsApp list synced (imported into Clients).'); 
    }
    catch (e) { alert('Sync failed:\n' + e.message); }
  }

  async function handleSend(){
    if (!selectedClients.length || !message) { 
      alert("Please select clients and write a message."); 
      return; 
    }
    const res = await fetch(url('/api/whatsapp/send-bulk'), {
      method:'POST', 
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ to: selectedClients, message, mediaUrl: imageUrl || undefined }),
    });
    const data = await res.json();
    if (res.ok && data.ok) alert("Messages sent successfully!"); 
    else alert("Failed: " + (data?.error || (res.status + " " + res.statusText)));
  }

  const handleSelectAll = () => {
    if (selectedClients.length === filtered.length) setSelectedClients([]);
    else setSelectedClients(filtered.map(c => c.phone));
  };

  // ⬆️⬆️ رفع الصورة
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(url("/api/upload"), { method: "POST", body: formData });
      const ctype = res.headers.get("content-type") || "";

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed (${res.status}). ${text.slice(0,200)}`);
      }
      if (!ctype.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Unexpected response. Not JSON:\n${text.slice(0,200)}`);
      }
      const data = await res.json();
      if (!data?.url) throw new Error("Invalid response: missing url");
      setImageUrl(data.url);
      alert("✅ Image uploaded successfully!");
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 whatsapp-page">
      <Card className="card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">WhatsApp</h2>
            <div className="flex items-center gap-2">
              <div>Status: {status}</div>
              <Button className="btn-gold" onClick={syncWA}>Sync WA</Button>
            </div>
          </div>

          {qrDataUrl && (
            <div className="mb-4">
              <div className="text-sm text-mute mb-1">Scan to connect:</div>
              <img src={qrDataUrl} alt="WhatsApp QR" className="w-56 h-56 border rounded" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Clients</h3>
                <Button 
                  onClick={handleSelectAll}
                  className="text-sm px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg transition-all duration-300 shadow-md"
                >
                  {selectedClients.length === filtered.length ? "Unselect All" : "Select All"}
                </Button>
              </div>

              <input 
                className="w-full border rounded p-2 mb-2" 
                placeholder="Search by name or phone…" 
                value={q} 
                onChange={(e)=>setQ(e.target.value)} 
              />

              <div className="max-h-80 overflow-y-auto border rounded p-2">
                {filtered.map(c => (
                  <label key={c._id || c.phone || Math.random()} className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox" 
                      checked={selectedClients.includes(c.phone)} 
                      onChange={()=>toggle(c.phone)} 
                    />
                    <span>{c.name}</span>
                    <span className="text-mute">({c.phone})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Message</h3>
              <textarea 
                className="w-full border rounded p-2" 
                rows={6} 
                value={message} 
                onChange={(e)=>setMessage(e.target.value)} 
                placeholder="Write your message here..." 
              />

              {/* زر رفع الصورة */}
              <div className="my-2">
                <label className="block text-sm mb-1 text-gray-300">Attach Image (optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-200 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-yellow-500 file:text-black hover:file:bg-yellow-600 cursor-pointer"
                />
                {uploading && <div className="text-yellow-400 text-sm mt-1">Uploading...</div>}
                {imageUrl && (
                  <div className="mt-2">
                    <img src={imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded" />
                  </div>
                )}
              </div>

              <Button className="btn-gold" onClick={handleSend}>Send</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
