import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Sprout, LayoutDashboard, Users, MapPinned, CalendarDays, CloudRain, Bell,
  Search, Plus, ArrowUpRight, Wheat, CircleCheck, Clock3, MapPin, Menu,
  X, ChevronRight, MoreHorizontal, Trash2, Pencil, Eye, RefreshCw, Activity,
  ShieldCheck, Tractor, Leaf, AlertTriangle, CloudSun, Check, ExternalLink,
  UserRound, LogOut, SlidersHorizontal, PackageCheck, Navigation, Send
} from "lucide-react";
import "./style.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
async function api(path, options={}) {
  const res = await fetch(`${API}${path}`, { headers: { "Content-Type":"application/json", ...(options.headers||{}) }, ...options });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const money = n => new Intl.NumberFormat("en-IN").format(n || 0);
const dateShort = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const initials = s => (s||"F").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();

function App(){
  const [page,setPage]=useState("Overview"), [role,setRole]=useState("Admin"), [mobileNav,setMobileNav]=useState(false);
  const [farmers,setFarmers]=useState([]), [centres,setCentres]=useState([]), [bookings,setBookings]=useState([]), [weather,setWeather]=useState([]), [notifications,setNotifications]=useState([]), [stats,setStats]=useState({});
  const [loading,setLoading]=useState(true), [error,setError]=useState(""), [toast,setToast]=useState("");
  const [search,setSearch]=useState(""), [modal,setModal]=useState(""), [selected,setSelected]=useState(null);
  const [farmerForm,setFarmerForm]=useState({name:"",mobile:"",village:"",district:"Indore",preferred_language:"Hindi",latitude:"",longitude:""});
  const [bookingForm,setBookingForm]=useState({farmer_id:"",crop:"Wheat",booking_date:new Date(Date.now()+86400000).toISOString().slice(0,10),quantity_quintals:"",allocations:[]});
  const [centreForm,setCentreForm]=useState({name:"",address:"",village:"",latitude:"",longitude:"",capacity_quintals:500,available_quintals:250});
  const [statusValue,setStatusValue]=useState("Waiting for procurement");
  const [weatherCentre,setWeatherCentre]=useState("");
  const [weatherRefreshing,setWeatherRefreshing]=useState(false);
  const [farmerView,setFarmerView]=useState("");

  const notify=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),3500)};
  async function load(){
    try{
      setError("");
      const [f,c,b,w,n,s]=await Promise.all([api("/farmers"),api("/centres"),api("/bookings"),api("/weather"),api("/notifications"),api("/dashboard")]);
      setFarmers(f);setCentres(c);setBookings(b);setWeather(w);setNotifications(n);setStats(s);
      if(!weatherCentre && c.length) setWeatherCentre(c[0].id);
      if(!farmerView && f.length) setFarmerView(f.find(x=>x.is_active)?.id || f[0].id);
    }catch(e){setError(e.message); }finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  useEffect(()=>{
    if(!toast)return; const t=setTimeout(()=>setToast(""),3500);return()=>clearTimeout(t);
  },[toast]);

  const activeFarmers=farmers.filter(f=>f.is_active);
  const filteredFarmers=farmers.filter(f=>`${f.name} ${f.mobile} ${f.farmer_code} ${f.village}`.toLowerCase().includes(search.toLowerCase()));
  const currentFarmer=farmers.find(f=>f.id===farmerView);
  const farmerBookings=bookings.filter(b=>b.farmer_id===farmerView);
  const farmerNotifications=notifications.filter(n=>n.farmer_id===farmerView);
  const nav=[["Overview",LayoutDashboard],["Farmers",Users],["Procurement Centres",MapPinned],["Bookings & Split Selling",CalendarDays],["Live Tracking",Activity],["Weather & Alerts",CloudRain],["Notifications",Bell]];
  const go=p=>{setPage(p);setMobileNav(false);};

  async function saveFarmer(e){
    e.preventDefault();
    try{
      const payload={...farmerForm,latitude:farmerForm.latitude===""?null:Number(farmerForm.latitude),longitude:farmerForm.longitude===""?null:Number(farmerForm.longitude)};
      if(selected) await api(`/farmers/${selected.id}`,{method:"PATCH",body:JSON.stringify(payload)});
      else await api("/farmers",{method:"POST",body:JSON.stringify(payload)});
      setModal("");setSelected(null);setFarmerForm({name:"",mobile:"",village:"",district:"Indore",preferred_language:"Hindi",latitude:"",longitude:""});
      await load();notify(selected?"Farmer details updated":"Farmer added and saved to database");
    }catch(e){notify(e.message);}
  }
  function editFarmer(f){setSelected(f);setFarmerForm({...f,latitude:f.latitude??"",longitude:f.longitude??""});setModal("farmer");}
  async function deleteFarmer(f){
    if(!confirm(`Deactivate ${f.name}? Their booking history will be preserved.`))return;
    try{await api(`/farmers/${f.id}`,{method:"DELETE"});await load();notify("Farmer deactivated successfully");}catch(e){notify(e.message);}
  }
  async function saveCentre(e){
    e.preventDefault();
    try{await api("/centres",{method:"POST",body:JSON.stringify({...centreForm,latitude:Number(centreForm.latitude),longitude:Number(centreForm.longitude),capacity_quintals:Number(centreForm.capacity_quintals),available_quintals:Number(centreForm.available_quintals)})});setModal("");setCentreForm({name:"",address:"",village:"",latitude:"",longitude:"",capacity_quintals:500,available_quintals:250});await load();notify("Procurement centre added");}catch(e){notify(e.message);}
  }
  async function saveBooking(e){
    e.preventDefault();
    try{
      await api("/bookings",{method:"POST",body:JSON.stringify({...bookingForm,quantity_quintals:Number(bookingForm.quantity_quintals),allocations:bookingForm.allocations.map(a=>({...a,quantity_quintals:Number(a.quantity_quintals)}))})});
      setModal("");setBookingForm({farmer_id:"",crop:"Wheat",booking_date:new Date(Date.now()+86400000).toISOString().slice(0,10),quantity_quintals:"",allocations:[]});await load();notify("Booking and split allocations saved");
    }catch(e){notify(e.message);}
  }
  async function updateStatus(id){
    try{await api(`/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status:statusValue,note:"Updated by evaluator through admin dashboard."})});await load();notify("Procurement tracking status updated");}catch(e){notify(e.message);}
  }
  async function simulateRain(){
    try{const r=await api("/weather/simulate-rain",{method:"POST",body:JSON.stringify({centre_id:weatherCentre})});await load();notify(r.message);}catch(e){notify(e.message);}
  }
  async function refreshLiveWeather(){
  try {
    setWeatherRefreshing(true);

    const result = await api("/weather/refresh-live", {
      method: "POST",
      body: JSON.stringify({})
    });

    await load();
    notify(result.message);

  } catch(e) {
    notify(e.message);
  } finally {
    setWeatherRefreshing(false);
  }
}
  async function markRead(n){try{await api(`/notifications/${n.id}/read`,{method:"PATCH",body:"{}"});await load();}catch(e){notify(e.message);}}
  const pageTitle=role==="Farmer"?"Farmer Portal":page;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"open":""}`}>
      <div className="brand"><div className="brand-mark"><Sprout size={23}/></div><div><b>Krishi Sarathi</b><small>SMART PROCUREMENT</small></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="workspace"><span className="workspace-dot"></span><div><b>Indore District</b><small>Demonstration workspace</small></div><MoreHorizontal size={18}/></div>
      <div className="nav-label">WORKSPACE</div>
      {role==="Admin"?<nav>{nav.map(([label,Icon])=><button key={label} className={`nav-item ${page===label?"active":""}`} onClick={()=>go(label)}><Icon size={18}/><span>{label}</span>{label==="Notifications"&&notifications.filter(n=>!n.is_read).length>0&&<i>{notifications.filter(n=>!n.is_read).length}</i>}</button>)}</nav>:<nav>{[["My Dashboard",LayoutDashboard],["My Bookings",CalendarDays],["Live Tracking",Activity],["Notifications",Bell]].map(([l,I])=><button key={l} className={`nav-item ${page===l?"active":""}`} onClick={()=>go(l)}><I size={18}/>{l}</button>)}</nav>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><ShieldCheck size={18}/></div><b>Demo environment</b><p>Sample farmer and mandi records for evaluator walkthrough.</p><span>All data is prototype data</span></div><div className="profile-mini"><div className="avatar">OF</div><div><b>Off By One</b><small>Project demonstration</small></div><MoreHorizontal size={18}/></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="top-left"><button className="hamburger" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={14}/> <b>{pageTitle}</b></div></div>
        <div className="top-actions"><div className="live-pill"><span></span> System connected</div><select value={role} onChange={e=>{setRole(e.target.value);setPage(e.target.value==="Farmer"?"My Dashboard":"Overview");}}><option>Admin</option><option>Farmer</option></select><button className="icon-btn" title="Refresh data" onClick={load}><RefreshCw size={17}/></button><div className="top-avatar">OF</div></div>
      </header>
      <div className="content">
        {error&&<div className="error-banner"><AlertTriangle size={18}/><div><b>Could not load live database data</b><p>{error}</p><small>Check that the backend is running and Supabase is configured. See README.md.</small></div><button onClick={load}>Retry</button></div>}
        {loading?<div className="loading"><div className="spinner"></div>Connecting to Krishi Sarathi database…</div>:null}
        {!loading&&role==="Admin"&&page==="Overview"&&<Overview stats={stats} farmers={farmers} bookings={bookings} centres={centres} weather={weather} go={go}/>}
        {!loading&&role==="Admin"&&page==="Farmers"&&<section>
          <PageHead eyebrow="FARMER DIRECTORY" title="Farmer management" desc="Register, update and manage farmer profiles across the district." action={<button className="btn primary" onClick={()=>{setSelected(null);setFarmerForm({name:"",mobile:"",village:"",district:"Indore",preferred_language:"Hindi",latitude:"",longitude:""});setModal("farmer");}}><Plus size={17}/> Add new farmer</button>}/>
          <div className="toolbar"><div className="searchbox"><Search size={17}/><input placeholder="Search name, farmer ID, mobile or village…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{filteredFarmers.length} records</span></div>
          <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>FARMER</th><th>FARMER ID</th><th>LOCATION</th><th>MOBILE</th><th>LANGUAGE</th><th>STATUS</th><th></th></tr></thead><tbody>{filteredFarmers.map(f=><tr key={f.id}><td><div className="person-cell"><div className="avatar green">{initials(f.name)}</div><div><b>{f.name}</b><small>Registered {dateShort(f.created_at)}</small></div></div></td><td><span className="code">{f.farmer_code}</span></td><td>{f.village}, {f.district}</td><td>{f.mobile}</td><td>{f.preferred_language}</td><td><span className={`status ${f.is_active?"good":"muted-status"}`}>{f.is_active?"Active":"Inactive"}</span></td><td><div className="row-actions"><button title="View location" onClick={()=>{setSelected(f);setModal("location");}}><MapPin size={16}/></button><button title="Edit farmer" onClick={()=>editFarmer(f)}><Pencil size={16}/></button><button title="Deactivate farmer" onClick={()=>deleteFarmer(f)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>{filteredFarmers.length===0&&<Empty title="No farmers found" text="Try another search or register a new farmer."/>}</div>
        </section>}
        {!loading&&role==="Admin"&&page==="Procurement Centres"&&<section>
          <PageHead eyebrow="MANDI NETWORK" title="Procurement centres" desc="View centre locations, capacity and availability across Indore." action={<button className="btn primary" onClick={()=>setModal("centre")}><Plus size={17}/> Add centre</button>}/>
          <div className="centre-grid">{centres.map(c=><div className="panel centre-card" key={c.id}><div className="centre-top"><div className="centre-icon"><MapPinned/></div><span className="status good">Operational</span></div><h3>{c.name}</h3><p>{c.address}</p><div className="capacity"><div><span>Available capacity</span><b>{money(c.available_quintals)} qtl</b></div><div className="progress"><i style={{width:`${Math.min(100,100*(1-Number(c.available_quintals)/Math.max(1,Number(c.capacity_quintals))))}%`}}/></div><small>{money(c.capacity_quintals)} qtl total capacity</small></div><a className="map-link" href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=14/${c.latitude}/${c.longitude}`} target="_blank" rel="noreferrer"><Navigation size={15}/> View on map <ExternalLink size={13}/></a></div>)}</div>
          <div className="panel map-panel"><div><b>Indore procurement network</b><p>Open individual centre pins in OpenStreetMap using the centre cards above.</p></div><div className="map-placeholder"><MapPinned size={34}/><b>{centres.length} registered procurement centres</b><span>Centre coordinates are stored in the database.</span></div></div>
        </section>}
        {!loading&&role==="Admin"&&page==="Bookings & Split Selling"&&<section>
          <PageHead eyebrow="PROCUREMENT SCHEDULING" title="Bookings & split selling" desc="Create bookings and distribute crop quantities across multiple centres." action={<button className="btn primary" onClick={()=>{setBookingForm({...bookingForm,farmer_id:activeFarmers[0]?.id||"",allocations:[]});setModal("booking");}}><Plus size={17}/> Create booking</button>}/>
          <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>BOOKING</th><th>FARMER</th><th>CROP</th><th>QUANTITY</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td className="code">KS-{String(b.id).slice(0,8).toUpperCase()}</td><td><b>{b.farmers?.name||"Farmer"}</b><small>{b.farmers?.farmer_code}</small></td><td>{b.crop}</td><td><b>{b.quantity_quintals} qtl</b></td><td>{dateShort(b.booking_date)}</td><td><span className={`status ${b.status?.includes("Weather")?"warning":"good"}`}>{b.status}</span></td></tr>)}</tbody></table></div>{bookings.length===0&&<Empty title="No bookings yet" text="Create a booking to demonstrate procurement scheduling and split selling."/>}</div>
        </section>}
        {!loading&&role==="Admin"&&page==="Live Tracking"&&<Tracking bookings={bookings} statusValue={statusValue} setStatusValue={setStatusValue} updateStatus={updateStatus}/>}
        {!loading&&role==="Admin"&&page==="Weather & Alerts"&&<section>
          
<PageHead
  eyebrow="WEATHER INTELLIGENCE"
  title="Weather monitoring"
  desc="Monitor live weather forecasts across all procurement centres."
  action={
    <button
      className="btn secondary"
      onClick={refreshLiveWeather}
      disabled={weatherRefreshing}
    >
      <RefreshCw size={17}/>
      {weatherRefreshing ? "Refreshing..." : "Refresh Live Weather"}
    </button>
  }
/>

          <div className="weather-hero"><div><span className="eyebrow light">EVALUATOR DEMONSTRATION</span><h2>Test the weather alert workflow</h2><p>Choose a procurement centre and trigger a controlled heavy-rain event. The backend checks bookings allocated to that centre and creates farmer notifications.</p><div className="simulate-row"><select value={weatherCentre} onChange={e=>setWeatherCentre(e.target.value)}>{centres.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn white" onClick={simulateRain}><CloudRain size={17}/> Simulate heavy rain</button></div></div><div className="rain-art"><CloudRain size={88}/><span>95%</span><small>Rain probability</small></div></div>
          <div className="section-title"><div><h3>Centre-wise weather records</h3><p>Sample records and evaluator-triggered events stored in PostgreSQL.</p></div></div>
          <div className="panel table-panel"><div className="table-wrap"><table>
<tbody>
  {weather.map(w => (
    <tr key={w.id}>
      <td><b>{w.centres?.name || "Procurement centre"}</b></td>
      <td>{dateShort(w.forecast_for)}</td>
      <td>{w.condition}</td>
      <td>{w.temperature_c}°C</td>
      <td>{w.humidity_percent}%</td>
      <td>{w.rainfall_probability}%</td>
      <td>{w.rainfall_mm} mm</td>
      <td>
        <span className={`status ${w.severity === "high" ? "warning" : "good"}`}>
          {w.severity}
        </span>
      </td>
      <td>{w.source}</td>
    </tr>
  ))}
</tbody>
</table></div></div>
        </section>}
        {!loading&&role==="Admin"&&page==="Notifications"&&<Notifications notifications={notifications} markRead={markRead}/>}
        {!loading&&role==="Farmer"&&<FarmerPortal farmer={currentFarmer} farmers={activeFarmers} setFarmer={setFarmerView} bookings={farmerBookings} notifications={farmerNotifications} markRead={markRead} go={go}/>}
      </div>
      <footer><span>© 2026 Krishi Sarathi</span><span><i className="footer-dot"/> Prototype environment · Off By One</span></footer>
    </main>

    {modal==="farmer"&&<Modal title={selected?"Edit farmer details":"Register new farmer"} close={()=>setModal("")}><form onSubmit={saveFarmer} className="form-grid"><Field label="Farmer full name" required><input required value={farmerForm.name} onChange={e=>setFarmerForm({...farmerForm,name:e.target.value})} placeholder="e.g. Ramesh Patel"/></Field><Field label="Mobile number" required><input required pattern="[0-9]{10}" title="Enter 10 digit mobile number" value={farmerForm.mobile} onChange={e=>setFarmerForm({...farmerForm,mobile:e.target.value})} placeholder="10-digit mobile"/></Field><Field label="Village" required><input required value={farmerForm.village} onChange={e=>setFarmerForm({...farmerForm,village:e.target.value})} placeholder="Village name"/></Field><Field label="District"><input value={farmerForm.district} onChange={e=>setFarmerForm({...farmerForm,district:e.target.value})}/></Field><Field label="Preferred language"><select value={farmerForm.preferred_language} onChange={e=>setFarmerForm({...farmerForm,preferred_language:e.target.value})}><option>Hindi</option><option>English</option><option>Malvi</option></select></Field><div className="form-section">Optional map coordinates <small>Use approximate demo coordinates; no precise farmer address is required.</small></div><Field label="Latitude"><input type="number" step="any" value={farmerForm.latitude} onChange={e=>setFarmerForm({...farmerForm,latitude:e.target.value})} placeholder="22.7196"/></Field><Field label="Longitude"><input type="number" step="any" value={farmerForm.longitude} onChange={e=>setFarmerForm({...farmerForm,longitude:e.target.value})} placeholder="75.8577"/></Field><div className="modal-actions"><button type="button" className="btn ghost" onClick={()=>setModal("")}>Cancel</button><button className="btn primary"><Check size={16}/>{selected?"Save changes":"Register farmer"}</button></div></form></Modal>}
    {modal==="centre"&&<Modal title="Add procurement centre" close={()=>setModal("")}><form onSubmit={saveCentre} className="form-grid"><Field label="Centre name" required><input required value={centreForm.name} onChange={e=>setCentreForm({...centreForm,name:e.target.value})}/></Field><Field label="Address" required><input required value={centreForm.address} onChange={e=>setCentreForm({...centreForm,address:e.target.value})}/></Field><Field label="Village / area"><input value={centreForm.village} onChange={e=>setCentreForm({...centreForm,village:e.target.value})}/></Field><Field label="Latitude" required><input required type="number" step="any" value={centreForm.latitude} onChange={e=>setCentreForm({...centreForm,latitude:e.target.value})}/></Field><Field label="Longitude" required><input required type="number" step="any" value={centreForm.longitude} onChange={e=>setCentreForm({...centreForm,longitude:e.target.value})}/></Field><Field label="Total capacity (qtl)"><input type="number" value={centreForm.capacity_quintals} onChange={e=>setCentreForm({...centreForm,capacity_quintals:e.target.value})}/></Field><Field label="Available capacity (qtl)"><input type="number" value={centreForm.available_quintals} onChange={e=>setCentreForm({...centreForm,available_quintals:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="btn ghost" onClick={()=>setModal("")}>Cancel</button><button className="btn primary"><Plus size={16}/> Add centre</button></div></form></Modal>}
    {modal==="booking"&&<Modal title="Create procurement booking" close={()=>setModal("")}><form onSubmit={saveBooking} className="form-grid"><Field label="Farmer" required><select required value={bookingForm.farmer_id} onChange={e=>setBookingForm({...bookingForm,farmer_id:e.target.value})}><option value="">Select farmer</option>{activeFarmers.map(f=><option key={f.id} value={f.id}>{f.name} · {f.farmer_code}</option>)}</select></Field><Field label="Crop"><select value={bookingForm.crop} onChange={e=>setBookingForm({...bookingForm,crop:e.target.value})}><option>Wheat</option><option>Soybean</option><option>Gram</option></select></Field><Field label="Booking date" required><input required type="date" value={bookingForm.booking_date} onChange={e=>setBookingForm({...bookingForm,booking_date:e.target.value})}/></Field><Field label="Total quantity (quintals)" required><input required min="1" type="number" value={bookingForm.quantity_quintals} onChange={e=>setBookingForm({...bookingForm,quantity_quintals:e.target.value})}/></Field><div className="form-section">Split quantity across centres <small>Allocation total must exactly match the booking quantity.</small></div>{centres.map(c=><div className="split-row" key={c.id}><div><b>{c.name}</b><small>{c.available_quintals} qtl available</small></div><input type="number" min="0" placeholder="0 qtl" value={bookingForm.allocations.find(a=>a.centre_id===c.id)?.quantity_quintals||""} onChange={e=>{const next=bookingForm.allocations.filter(a=>a.centre_id!==c.id);if(e.target.value)next.push({centre_id:c.id,quantity_quintals:e.target.value});setBookingForm({...bookingForm,allocations:next});}}/></div>)}<div className="allocation-total"><span>Allocated quantity</span><b>{bookingForm.allocations.reduce((s,a)=>s+Number(a.quantity_quintals||0),0)} / {bookingForm.quantity_quintals||0} qtl</b></div><div className="modal-actions"><button type="button" className="btn ghost" onClick={()=>setModal("")}>Cancel</button><button className="btn primary"><CalendarDays size={16}/> Confirm booking</button></div></form></Modal>}
    {modal==="location"&&selected&&<Modal title="Farmer location" close={()=>setModal("")}><div className="location-card"><div className="location-pin"><MapPin size={26}/></div><h3>{selected.name}</h3><p>{selected.village}, {selected.district}</p><div className="coord-box"><span>LATITUDE</span><b>{selected.latitude??"Not provided"}</b><span>LONGITUDE</span><b>{selected.longitude??"Not provided"}</b></div>{selected.latitude&&selected.longitude?<a className="btn primary full" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=15/${selected.latitude}/${selected.longitude}`}><Navigation size={16}/> Open farmer location on map</a>:<p className="muted">No coordinates saved for this farmer. Edit the profile to add demo coordinates.</p>}</div></Modal>}
    {toast&&<div className="toast"><CircleCheck size={18}/>{toast}</div>}
  </div>;
}

function PageHead({eyebrow,title,desc,action}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Overview({stats,farmers,bookings,centres,weather,go}){
 const recent=farmers.filter(f=>f.is_active).slice(0,5);
 return <section><PageHead eyebrow="MONDAY, NOVEMBER 2026" title="Good afternoon, Admin" desc="Here’s what’s happening across your procurement network today." action={<button className="btn secondary" onClick={()=>go("Farmers")}><Users size={17}/> Manage farmers</button>}/>
 <div className="welcome-strip"><div className="welcome-icon"><Sprout size={25}/></div><div><b>Your procurement network is ready</b><p>Monitor farmer registrations, procurement activity and weather conditions from one workspace.</p></div><span className="network-status"><i/> Operational</span></div>
 <div className="stat-grid"><Stat icon={Users} label="Registered farmers" value={money(stats.farmers)} trend="Active farmer profiles" tone="green"/><Stat icon={MapPinned} label="Procurement centres" value={money(stats.centres)} trend="Across Indore district" tone="blue"/><Stat icon={CalendarDays} label="Total bookings" value={money(stats.bookings)} trend="Procurement schedules" tone="purple"/><Stat icon={Wheat} label="Crop quantity booked" value={`${money(stats.quintals)} qtl`} trend="Across all bookings" tone="amber"/></div>
 <div className="dashboard-grid"><div className="panel"><div className="panel-head"><div><h3>Recent farmer registrations</h3><p>Latest farmer profiles in your network</p></div><button className="text-btn" onClick={()=>go("Farmers")}>View all <ChevronRight size={15}/></button></div><div className="recent-list">{recent.map(f=><div className="recent-person" key={f.id}><div className="avatar green">{initials(f.name)}</div><div className="grow"><b>{f.name}</b><small>{f.village}, {f.district}</small></div><span className="code">{f.farmer_code}</span></div>)}</div></div>
 <div className="panel"><div className="panel-head"><div><h3>Weather overview</h3><p>Latest forecast records</p></div><button className="text-btn" onClick={()=>go("Weather & Alerts")}>Details <ChevronRight size={15}/></button></div><div className="weather-summary"><div className="weather-symbol"><CloudSun size={38}/></div><div><b>{weather[0]?.condition||"Forecast data"}</b><small>{weather[0]?.centres?.name||"Indore procurement network"}</small></div><strong>{weather[0]?.temperature_c??"—"}°C</strong></div><div className="weather-foot"><span><CloudRain size={15}/> Rain probability</span><b>{weather[0]?.rainfall_probability??"—"}%</b></div><div className="weather-foot"><span><AlertTriangle size={15}/> Active alerts</span><b>{weather.filter(w=>w.severity==="high").length}</b></div></div></div>
 <div className="panel"><div className="panel-head"><div><h3>Recent procurement activity</h3><p>Latest bookings across your centres</p></div><button className="text-btn" onClick={()=>go("Bookings & Split Selling")}>All bookings <ChevronRight size={15}/></button></div><div className="table-wrap"><table><thead><tr><th>FARMER</th><th>CROP</th><th>QUANTITY</th><th>STATUS</th></tr></thead><tbody>{bookings.slice(0,5).map(b=><tr key={b.id}><td><b>{b.farmers?.name||"Farmer"}</b></td><td>{b.crop}</td><td>{b.quantity_quintals} qtl</td><td><span className={`status ${b.status?.includes("Weather")?"warning":"good"}`}>{b.status}</span></td></tr>)}</tbody></table></div></div>
 </section>;
}
function Stat({icon:Icon,label,value,trend,tone}){return <div className="panel stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><span>{label}</span><strong>{value??"—"}</strong><small>{trend}</small></div>}
function Empty({title,text}){return <div className="empty"><div><Sprout size={25}/></div><b>{title}</b><p>{text}</p></div>}
function Tracking({bookings,statusValue,setStatusValue,updateStatus}){return <section><PageHead eyebrow="PROCUREMENT JOURNEY" title="Live procurement tracking" desc="Update demo procurement milestones and see the farmer journey progress."/><div className="tracking-list">{bookings.map(b=><div className="panel tracking-card" key={b.id}><div className="tracking-head"><div><span className="code">KS-{String(b.id).slice(0,8).toUpperCase()}</span><h3>{b.farmers?.name||"Farmer"} · {b.crop}</h3><p>{b.quantity_quintals} quintals · {dateShort(b.booking_date)}</p></div><span className="status good">{b.status}</span></div><div className="timeline-mini">{["Booking confirmed","Farmer arrived","Crop weighing","Quality verification","Procurement completed"].map((s,i)=><div className={`timeline-step ${b.status===s?"current":i<["Booking confirmed","Farmer arrived","Crop weighing","Quality verification","Procurement completed"].indexOf(b.status)?"done":""}`} key={s}><i>{i<["Booking confirmed","Farmer arrived","Crop weighing","Quality verification","Procurement completed"].indexOf(b.status)?<Check size={12}/>:i+1}</i><span>{s}</span></div>)}</div><div className="tracking-update"><select value={statusValue} onChange={e=>setStatusValue(e.target.value)}>{["Booking confirmed","Waiting for procurement","Farmer arrived","Crop weighing","Quality verification","Procurement completed","Payment initiated","Payment completed"].map(s=><option key={s}>{s}</option>)}</select><button className="btn primary small" onClick={()=>updateStatus(b.id)}>Update status</button></div></div>)}{bookings.length===0&&<Empty title="No tracking records" text="Create a booking first to demonstrate live procurement tracking."/>}</div></section>}
function Notifications({notifications,markRead}){return <section><PageHead eyebrow="ALERT CENTRE" title="Notifications" desc="Weather alerts and procurement updates generated by the system."/><div className="notification-list">{notifications.map(n=><div className={`panel notification ${n.is_read?"read":""}`} key={n.id}><div className={`notification-icon ${n.severity==="high"?"danger":""}`}><Bell size={19}/></div><div className="grow"><div className="notification-title"><b>{n.title}</b>{!n.is_read&&<span className="new-dot"/>}</div><p>{n.message}</p><small>{n.farmers?.name||"System"} · {dateShort(n.created_at)}</small></div>{!n.is_read&&<button className="btn secondary small" onClick={()=>markRead(n)}>Mark read</button>}</div>)}{notifications.length===0&&<Empty title="All quiet here" text="Weather and booking alerts will appear here."/>}</div></section>}
function FarmerPortal({farmer,farmers,setFarmer,bookings,notifications,markRead,go}){return <section><PageHead eyebrow="FARMER SELF-SERVICE" title={`Namaste${farmer?", "+farmer.name.split(" ")[0]:""}`} desc="View your procurement bookings, crop journey and important alerts." action={<select className="farmer-select" value={farmer?.id||""} onChange={e=>setFarmer(e.target.value)}>{farmers.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>}/>{!farmer?<Empty title="No active farmer" text="Ask the administrator to register a farmer first."/>:<><div className="farmer-welcome"><div className="avatar large">{initials(farmer.name)}</div><div><span className="eyebrow">FARMER PROFILE · {farmer.farmer_code}</span><h2>{farmer.name}</h2><p><MapPin size={14}/>{farmer.village}, {farmer.district} <span>·</span> {farmer.mobile}</p></div><span className="status good">Verified demo profile</span></div><div className="stat-grid three"><Stat icon={CalendarDays} label="My bookings" value={bookings.length} trend="All procurement schedules" tone="blue"/><Stat icon={Wheat} label="Total crop quantity" value={`${bookings.reduce((s,b)=>s+Number(b.quantity_quintals),0)} qtl`} trend="Across my bookings" tone="green"/><Stat icon={Bell} label="Notifications" value={notifications.length} trend="Weather and booking alerts" tone="amber"/></div><div className="panel"><div className="panel-head"><div><h3>My procurement journey</h3><p>Track the progress of your crop bookings.</p></div></div>{bookings.map(b=><div className="farmer-booking" key={b.id}><div><span className="code">KS-{String(b.id).slice(0,8).toUpperCase()}</span><h3>{b.crop} · {b.quantity_quintals} quintals</h3><p>Booking date: {dateShort(b.booking_date)}</p></div><span className={`status ${b.status?.includes("Weather")?"warning":"good"}`}>{b.status}</span></div>)}{bookings.length===0&&<Empty title="No bookings yet" text="Your procurement bookings will appear here."/>}</div><div className="panel"><div className="panel-head"><div><h3>Important notifications</h3><p>Stay informed about your bookings and weather conditions.</p></div></div>{notifications.map(n=><div className="notification" key={n.id}><div className="notification-icon danger"><CloudRain size={19}/></div><div className="grow"><b>{n.title}</b><p>{n.message}</p></div>{!n.is_read&&<button className="btn secondary small" onClick={()=>markRead(n)}>Mark read</button>}</div>)}{notifications.length===0&&<Empty title="No new alerts" text="We will display booking and weather notifications here."/>}</div></>}</section>}
function Modal({title,close,children}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={close}><X/></button></div>{children}</div></div>}
function Field({label,required,children}){return <label className="field"><span>{label}{required&&<i>*</i>}</span>{children}</label>}

createRoot(document.getElementById("root")).render(<App/>);
