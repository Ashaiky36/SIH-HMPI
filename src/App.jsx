// /* SIH HMPI Frontend Starter (React + Tailwind + Leaflet + Recharts + Framer Motion + shadcn)

// Purpose:
// Single-file starter React component (default export) that implements:
// - Landing + upload UI (drag & drop + preview)
// - Map (react-leaflet) with color-coded markers & popups
// - Simple charts (Recharts) for Safe/Moderate/Unsafe counts
// - Mock data + hooks to connect to backend endpoints
// - Smooth UI polish with Framer Motion and Tailwind

// Important: This is a starter file you can paste into a Vite + React project (or into your src/App.jsx).
// Dependencies to install (npm or yarn): 
// npm i react react-dom 
// npm i -D vite 
// npm i tailwindcss postcss autoprefixer && npx tailwindcss init -p 
// npm i react-leaflet leaflet 
// npm i recharts 
// npm i framer-motion 
// npm i papaparse 
// npm i @shadcn/ui lucide-react

// Tailwind: make sure you enable the content paths and import the base styles in index.css 
// Leaflet: remember to import Leaflet css somewhere globally: "import 'leaflet/dist/leaflet.css'"

// How to use:
// 1. Place this file as src/App.jsx or paste component into your app.
// 2. Start the dev server and open localhost:5173 (Vite default).
// 3. Replace the mock API hooks with your Django API endpoints (/upload, /compute, /samples).
// */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Download, UploadCloud, MapPin, BarChart2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

const CATEGORY_COLORS = { Safe: '#16a34a', Moderate: '#f59e0b', Unsafe: '#ef4444' };

function computeIndexFromRow(row) {
  // WHO / IS 10500 limits (mg/L)
  const limits = { Fe: 0.3, Mn: 0.1, As: 0.01, Pb: 0.01, Cd: 0.003 };
  // Ideal values (0 for toxic metals, 0 for As, Pb, Cd; Fe and Mn often taken as 0 too)
  const ideals = { Fe: 0, Mn: 0, As: 0, Pb: 0, Cd: 0 };

  let numerator = 0;
  let denominator = 0;

  for (const metal of Object.keys(limits)) {
    const Mi = parseFloat(row[metal]) || 0;
    const Si = limits[metal];
    const Ii = ideals[metal];
    const Wi = 1 / Si;

    // Quality rating Qi
    const Qi = ((Mi - Ii) / (Si - Ii)) * 100;

    numerator += Qi * Wi;
    denominator += Wi;
  }

  const HPI = numerator / denominator;

  //let category = "Safe";
  //if (HPI > 30) category = "Unsafe";
  //else if (HPI >= 15) category = "Moderate";

  let category = "Unsafe";
  if (HPI < 100 ) category = "Safe";
  else if (HPI <= 150 ) category = "Moderate";

  return { index: Number(HPI.toFixed(2)), category };
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
}

export default function App() {
  const [stage, setStage] = useState('landing');
  const [filePreview, setFilePreview] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [samples, setSamples] = useState([]);
  const [filter, setFilter] = useState({ metal: 'All', category: 'All' });
  const fileInputRef = useRef();
  const reportRef = useRef();

  const stats = useMemo(() => {
    const counts = { Safe: 0, Moderate: 0, Unsafe: 0 };
    for (const s of samples) counts[s.category] = (counts[s.category] || 0) + 1;
    const total = samples.length || 1;
    return {
      counts,
      total,
      percentages: {
        Safe: Math.round((counts.Safe / total) * 100),
        Moderate: Math.round((counts.Moderate / total) * 100),
        Unsafe: Math.round((counts.Unsafe / total) * 100),
      },
    };
  }, [samples]);

  useEffect(() => {
    const mocked = [
      { Location: 'Well A', Latitude: 28.7041, Longitude: 77.1025, Fe: 100, Mn: 20, As: 0.01, Pb: 0.02, Cd: 0.001 },
      { Location: 'Well B', Latitude: 28.7048, Longitude: 77.1100, Fe: 20, Mn: 5, As: 0.06, Pb: 0.1, Cd: 0.005 },
      { Location: 'Well C', Latitude: 28.7100, Longitude: 77.1200, Fe: 400, Mn: 120, As: 0.2, Pb: 0.5, Cd: 0.02 },
    ];
    const enriched = mocked.map((r, i) => ({ id: i + 1, ...r, ...computeIndexFromRow(r) }));
    setSamples(enriched);
  }, []);

  // Robust PDF export function
  async function exportReport() {
    if (!reportRef.current) {
      alert("Go to the Analysis page first!");
      return;
    }

    try {
      await new Promise(res => setTimeout(res, 700)); // wait for charts/maps

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgPropsHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgPropsHeight;
      let position = 30;

      pdf.setFontSize(14);
      pdf.text("Heavy Metal Pollution Indices Report", 10, 10);
      pdf.setFontSize(10);
      pdf.text("Generated on: " + new Date().toLocaleString(), 10, 20);

      while (heightLeft > 0) {
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgPropsHeight);
        heightLeft -= pdfHeight - 30;
        if (heightLeft > 0) pdf.addPage();
        position = 0;
      }

      pdf.save('HMPI_Report.pdf');
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to generate PDF. Check console for details.");
    }
  }

  async function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilePreview(f.name + ' — ' + Math.round(f.size / 1024) + ' KB');
    const rows = await parseCsvFile(f);
    setRawRows(rows);
    const enriched = rows.map((r, idx) => {
      const coords = { 
        Latitude: parseFloat(r.Latitude) || parseFloat(r.lat) || 0, 
        Longitude: parseFloat(r.Longitude) || parseFloat(r.lon) || 0 
      };
      const base = { 
        id: idx + 1, 
        Location: r.Location || r.location || 'Unknown', 
        ...coords, 
        Fe: r.Fe, 
        Mn: r.Mn, 
        As: r.As, 
        Pb: r.Pb, 
        Cd: r.Cd 
      };
      return { ...base, ...computeIndexFromRow(base) };
    });
    setSamples(enriched);
    setStage('analysis');
  }

  function handleDrop(e) { 
    e.preventDefault(); 
    const f = e.dataTransfer.files?.[0]; 
    if (!f) return; 
    fileInputRef.current.files = e.dataTransfer.files; 
    handleFileSelect({ target: { files: [f] } }); 
  }

  function handleDragOver(e) { 
    e.preventDefault(); 
  }

  function filteredSamples() {
    return samples.filter(s => {
      if (filter.category !== 'All' && s.category !== filter.category) return false;
      if (filter.metal !== 'All') { 
        const mVal = parseFloat(s[filter.metal]) || 0; 
        if (mVal <= 0) return false; 
      }
      return true;
    });
  }

  const Header = () => (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-sky-600 w-10 h-10 flex items-center justify-center text-white font-bold">HM</div>
        <div>
          <h1 className="text-lg font-semibold">HMPI Dashboard</h1>
          <p className="text-xs text-muted-foreground">Heavy Metal Pollution Indices — SIH Demo</p>
        </div>
      </div>
      <nav className="flex items-center gap-3">
        <button onClick={() => setStage('landing')} className="px-3 py-1 rounded-md hover:bg-slate-100">Home</button>
        <button onClick={() => setStage('upload')} className="px-3 py-1 rounded-md bg-sky-600 text-white">Upload</button>
      </nav>
    </header>
  );

  const Landing = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8">
      <div className="rounded-2xl p-8 bg-gradient-to-r from-sky-50 to-white shadow">
        <h2 className="text-3xl font-bold">Heavy Metal Pollution Indices</h2>
        <p className="mt-2 text-slate-600">Interactive map, instant analysis, and exportable reports — built for rapid SIH demos.</p>
        <div className="mt-6 flex gap-4">
          <button onClick={() => setStage('upload')} className="px-6 py-3 rounded-lg bg-sky-600 text-white flex items-center gap-2">
            <UploadCloud size={16}/> Upload CSV
          </button>
          <button onClick={() => setStage('analysis')} className="px-6 py-3 rounded-lg border hover:bg-slate-50 flex items-center gap-2">
            <MapPin size={16}/> Open Demo Map
          </button>
        </div>
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold">Quick Stats</h3>
          <p className="text-3xl mt-2">{samples.length} Samples</p>
        </div>
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold">Unsafe Percentage</h3>
          <p className="text-3xl mt-2">{stats.percentages.Unsafe}%</p>
        </div>
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold">Top Polluted</h3>
          <p className="text-2xl mt-2">{samples.slice().sort((a,b)=>b.index-a.index)[0]?.Location || '—'}</p>
        </div>
      </div>
    </motion.div>
  );

  const Upload = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div onDrop={handleDrop} onDragOver={handleDragOver} className="border-dashed border-2 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-600">Drag & drop CSV file here</p>
            <p className="mt-4 text-xs text-muted-foreground">Columns: Location, Latitude, Longitude, Fe, Mn, As, Pb, Cd</p>
            <div className="mt-4 flex items-center justify-center">
              <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 rounded-md border flex items-center gap-2">
                <UploadCloud size={16}/> Choose file
              </button>
            </div>
            <input ref={fileInputRef} onChange={handleFileSelect} type="file" accept=".csv" className="hidden" />
            {filePreview && <p className="mt-3 text-sm">Selected: <strong>{filePreview}</strong></p>}
          </div>
          {rawRows && rawRows.length > 0 && (
            <div className="mt-4 p-3 rounded border max-h-60 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>{Object.keys(rawRows[0]).slice(0, 8).map(h => <th key={h} className="pr-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 8).map((r,i)=>(
                    <tr key={i} className="border-t">
                      {Object.values(r).slice(0,8).map((v,ii)=><td key={ii} className="py-1 text-xs pr-3">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold">Preview & Analysis</h3>
          <p className="text-sm text-slate-600 mt-1">After upload, the demo computes HMPI locally. Replace this with your backend call in production.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['All','Fe','Mn','As','Pb','Cd'].map(m=>(
              <button key={m} onClick={()=>setFilter(s=>({...s, metal:m}))} className={`p-2 rounded ${filter.metal===m?'bg-sky-600 text-white':'border'}`}>{m}</button>
            ))}
          </div>
          <div className="mt-4">
            <label className="text-xs">Category</label>
            <select value={filter.category} onChange={e=>setFilter(s=>({...s,category:e.target.value}))} className="mt-2 w-full p-2 border rounded">
              <option>All</option>
              <option>Safe</option>
              <option>Moderate</option>
              <option>Unsafe</option>
            </select>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={()=>setStage('analysis')} className="px-4 py-2 rounded bg-green-600 text-white flex items-center gap-2">
              <BarChart2 size={16}/> Compute
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const Analysis = () => (
    <div ref={reportRef} id="report-section" className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-xl border p-4 h-[70vh]">
        <h3 className="font-semibold mb-2">Interactive Map</h3>
        <MapContainer center={[28.7041,77.1025]} zoom={12} style={{height:'100%', width:'100%'}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          {filteredSamples().map(s => (
            <Marker key={s.id} position={[s.Latitude, s.Longitude]}>
              <Popup>
                <div className="text-sm">
                  <strong>{s.Location}</strong><br/>
                  Fe: {s.Fe}, Mn: {s.Mn}, As: {s.As}, Pb: {s.Pb}, Cd: {s.Cd}<br/>
                  Index: {s.index} ({s.category})
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Summary Statistics</h3>
        <p>Total Samples: {samples.length}</p>
        <p>Safe: {stats.counts.Safe} ({stats.percentages.Safe}%)</p>
        <p>Moderate: {stats.counts.Moderate} ({stats.percentages.Moderate}%)</p>
        <p>Unsafe: {stats.counts.Unsafe} ({stats.percentages.Unsafe}%)</p>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Safe', value: stats.counts.Safe },
                  { name: 'Moderate', value: stats.counts.Moderate },
                  { name: 'Unsafe', value: stats.counts.Unsafe },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                fill="#8884d8"
              >
                {['Safe','Moderate','Unsafe'].map((c,i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[c]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4">
          <button onClick={exportReport} className="w-full px-4 py-2 bg-blue-600 text-white rounded flex items-center justify-center gap-2">
            <Download size={14}/> Export Report
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <Header />
      <main>
        {stage === 'landing' && <Landing />}
        {stage === 'upload' && <Upload />}
        {stage === 'analysis' && <Analysis />}
      </main>

      <footer className="p-4 text-center text-sm text-slate-500 border-t">
        SIH Prototype • HMPI Dashboard By BroCode — Frontend Starter
      </footer>
    </div>
  );
}
