import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges, MarkerType } from '@xyflow/react';
import { Network, Files, Activity, FlaskConical, ChartNoAxesCombined, Moon, Sun, Plus, Trash2, RotateCcw, Play, Info, UploadCloud, ShieldCheck, Download, Split, HardDrive } from 'lucide-react';
import { splitFile, distributeChunks, reconstructFile, formatBytes, CHUNK_SIZES } from './fileEngine';
import { makeSwarm, tickSwarm, toggleOffline } from './swarmEngine';
import ExperimentLab from "./ExperimentLab";
import ResultsAnalysis from "./ResultsAnalysis";
const initialNodes = [
  {id:'A',position:{x:70,y:90},data:{label:'Peer A'},type:'default'},
  {id:'B',position:{x:380,y:60},data:{label:'Peer B'},type:'default'},
  {id:'C',position:{x:130,y:320},data:{label:'Peer C'},type:'default'},
  {id:'D',position:{x:460,y:300},data:{label:'Peer D (You)'},type:'default'}
];
const initialEdges = [ ['A','B'],['A','C'],['B','D'],['C','D'] ].map(([source,target],i)=>({id:`e${i}`,source,target,animated:true,markerEnd:{type:MarkerType.ArrowClosed}}));
const sections = [
  {id:'network',name:'Network Studio',icon:Network},
  {id:'files',name:'File Distribution',icon:Files},
  {id:'swarm',name:'Swarm Simulator',icon:Activity},
  {id:'experiments',name:'Experiment Lab',icon:FlaskConical},
  {id:'results',name:'Results & Analysis',icon:ChartNoAxesCombined}
];
export default function App(){
  const [theme,setTheme] = useState('dark');
  const [page,setPage] = useState('network');
  const [experimentResults, setExperimentResults] = useState(null);
  const [nodes,setNodes] = useState(initialNodes);
  const [edges,setEdges] = useState(initialEdges);
  const [selected,setSelected] = useState(null);
  const [events,setEvents] = useState(['Network initialized with four peers.']);
  const [pickedFile,setPickedFile] = useState(null);
  const [chunkKiB,setChunkKiB] = useState(256);
  const [fileRecord,setFileRecord] = useState(null);
  const [distribution,setDistribution] = useState({});
  const [fileBusy,setFileBusy] = useState(false);
  const [fileMessage,setFileMessage] = useState('');
  const [verified,setVerified] = useState(false);
  const [swarm,setSwarm] = useState(null);
  const [downloader,setDownloader] = useState('D');
  const [strategy,setStrategy] = useState('rarest');
  const [speed,setSpeed] = useState(512);
  const [latency,setLatency] = useState(1);
  const [loss,setLoss] = useState(0);
  const [swarmMessage,setSwarmMessage] = useState('');
  const lastSwarmEvent=useRef('');
  useEffect(()=>{
    if(swarm?.status!=='running')return;
    const id=setInterval(()=>setSwarm(s=>tickSwarm(s,fileRecord,{speedKiB:speed,latencyTicks:latency,lossPct:loss})),250);
    return ()=>clearInterval(id);
  },[swarm?.status,fileRecord,speed,latency,loss]);
  useEffect(()=>{
    if(!swarm?.lastEvent||lastSwarmEvent.current===swarm.lastEvent)return;
    lastSwarmEvent.current=swarm.lastEvent;
    setEvents(prev=>[swarm.lastEvent,...prev].slice(0,30));
  },[swarm?.lastEvent]);
  function initializeSwarm(){try{const next=makeSwarm(fileRecord,distribution,nodes,edges,downloader,strategy);setSwarm(next);setSwarmMessage('Swarm initialized. Press Start to download missing pieces.');lastSwarmEvent.current='';}catch(e){setSwarmMessage(`Error: ${e.message}`);}}
  function invalidateSwarm(){setSwarm(null);setSwarmMessage('Topology or file changed. Initialize a new swarm.');}
  async function downloadSwarm(){
    if(!swarm||swarm.status!=='complete')return;
    try{
      const blob=await reconstructFile(fileRecord,new Set(swarm.completed));
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileRecord.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      setSwarmMessage('Verified SHA-256: reconstructed file matches the original!');
    }catch(e){setSwarmMessage(`Error: ${e.message}`);}
  }
  const log = (message)=>setEvents(prev=>[message,...prev].slice(0,30));
  const onNodesChange=useCallback(changes=>setNodes(ns=>applyNodeChanges(changes,ns)),[]);
  const onEdgesChange=useCallback(changes=>{if(changes.some(c=>c.type==='remove'))setSwarm(null);setEdges(es=>applyEdgeChanges(changes,es));},[]);
  const onConnect=useCallback(params=>{setSwarm(null);setEdges(es=>addEdge({...params,animated:true,markerEnd:{type:MarkerType.ArrowClosed}},es));log(`Connected ${params.source} to ${params.target}.`);},[]);
  function addPeer(){invalidateSwarm();const id=`P${Date.now().toString().slice(-6)}`;setNodes(ns=>[...ns,{id,position:{x:100+(ns.length%4)*115,y:130+(ns.length%3)*85},data:{label:`Peer ${ns.length+1}`}}]);log(`New peer added (${id}).`)}
  function deleteSelected(){if(!selected)return;invalidateSwarm();setDistribution(prev=>{const next={...prev};delete next[selected];return next;});setNodes(ns=>ns.filter(n=>n.id!==selected));setEdges(es=>es.filter(e=>e.source!==selected&&e.target!==selected));log(`${selected} removed.`);setSelected(null)}
  function reset(){invalidateSwarm();setNodes(initialNodes);setEdges(initialEdges);setSelected(null);setDistribution({});setFileRecord(null);setVerified(false);log('Topology reset. File distribution cleared.');}
  async function prepareFile(){
    setFileBusy(true);setFileMessage('');setVerified(false);
    try {const record=await splitFile(pickedFile,chunkKiB);invalidateSwarm();setFileRecord(record);setDistribution({});log(`Split ${record.name} into ${record.chunks.length} verified chunks.`);setFileMessage('File chunked and hashed successfully. Now distribute it.');}
    catch(error){setFileMessage(`Error: ${error.message}`);}
    finally{setFileBusy(false);}
  }
  function distribute(){try{invalidateSwarm();const next=distributeChunks(fileRecord,nodes.map(n=>n.id));setDistribution(next);setVerified(false);log(`Distributed ${fileRecord.chunks.length} chunks across ${nodes.length} simulated peers (two copies where possible).`);setFileMessage('Chunks distributed to the simulated peers.');}catch(error){setFileMessage(`Error: ${error.message}`);}}
  async function downloadReconstructed(){
    setFileBusy(true);setFileMessage('');
    try{const ids=new Set(Object.values(distribution).flat());const blob=await reconstructFile(fileRecord,ids);setVerified(true);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileRecord.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setFileMessage('SHA-256 verified: downloaded file matches the original.');log(`Reconstructed and verified ${fileRecord.name}.`);}
    catch(error){setVerified(false);setFileMessage(`Error: ${error.message}`);}
    finally{setFileBusy(false);}
  }
  const selectedNode=nodes.find(n=>n.id===selected);
  const current=sections.find(s=>s.id===page);
  return <div className={`shell ${theme}`}>
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Network size={24}/></div><div><strong>P2P NEXUS</strong><small>NETWORK SIMULATION LAB</small></div></div><div className="sidebar-caption">WORKSPACES</div>
    <nav>{sections.map(s=><button key={s.id} className={`nav-item ${page===s.id?'active':''}`} onClick={()=>setPage(s.id)}><s.icon size={18}/><span>{s.name}</span>{!['network','files','swarm','experiments','results'].includes(s.id)&&<em>SOON</em>}</button>)}</nav>
    <div className="sidebar-footer"><div className="phase">PHASE 3 / 5<br/><strong>Live Swarm Simulator</strong></div><button className="theme-toggle" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>} {theme==='dark'?'Light mode':'Dark mode'}</button></div></aside>
    <main className="main"><header className="topbar"><div><div className="overline">DATA COMMUNICATION & NETWORKING / INTERACTIVE LAB</div><h1>{current.name}</h1></div><div className="top-actions"><span className="live"><span className="dot"/> SIMULATION READY</span><button className="icon-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div></header>
    {page==='network'?<><div className="workspace-heading"><div><h2>Topology Workspace</h2><p>Drag peers to reposition them. Drag from one handle to another to connect peers.</p></div><div className="toolbar"><button onClick={addPeer}><Plus size={16}/> Add Peer</button><button onClick={deleteSelected} disabled={!selected}><Trash2 size={16}/> Remove Peer</button><button onClick={reset}><RotateCcw size={16}/> Reset</button></div></div>
    <div className="workspace"><div className="canvas"><div className="canvas-tag"><span className="dot"/> LIVE TOPOLOGY <span className="muted">{nodes.length} PEERS · {edges.length} LINKS</span></div><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_,node)=>setSelected(node.id)} onPaneClick={()=>setSelected(null)} fitView><Background gap={24} size={1}/><MiniMap pannable zoomable/><Controls/></ReactFlow></div>
    <aside className="inspector"><div className="inspector-label">INSPECTOR</div>{selectedNode?<><h3>{selectedNode.data.label}</h3><span className="online">● Online</span><div className="metric"><span>Peer ID</span><b>{selectedNode.id}</b></div><div className="metric"><span>Connections</span><b>{edges.filter(e=>e.source===selected||e.target===selected).length}</b></div><div className="metric"><span>Chunks</span><b>{(distribution[selected]||[]).length}</b></div><p className="hint">Open File Distribution to allocate real file chunks.</p></>:<><div className="empty-icon"><Info size={23}/></div><h3>Select a peer</h3><p>Click any node to inspect its status and connections.</p></>}<div className="explain"><b>WHAT TO SAY</b><p>“Each computer is a peer. Peers can be connected to one another and exchange resources without a central file server.”</p></div></aside></div>
    <div className="console"><div className="console-title"><Activity size={16}/> EVENT CONSOLE <span>LOCAL SIMULATION</span></div><div className="console-lines">{events.map((e,i)=><div key={i}><span>›</span> {e}</div>)}</div></div></>:page==='files'?<>
      <div className="workspace-heading"><div><h2>Real File Processing</h2><p>Read file bytes locally, generate chunk hashes, assign replicas to peers and reconstruct the original.</p></div><div className="toolbar"><button onClick={()=>setPage('network')}><Network size={16}/> View Topology</button></div></div>
      <div className="file-layout"><section className="file-panel"><div className="panel-heading"><UploadCloud size={19}/><h3>1 · Choose & Split File</h3></div><label className="upload-zone"><UploadCloud size={28}/><strong>{pickedFile?pickedFile.name:'Select a file from your computer'}</strong><span>{pickedFile?formatBytes(pickedFile.size):'PDF, image, text, or any other file · max 20 MB'}</span><input type="file" onChange={e=>{setPickedFile(e.target.files?.[0]||null);setFileRecord(null);setDistribution({});setVerified(false);setFileMessage('');invalidateSwarm();}}/></label><div className="file-field"><label htmlFor="chunkSize">Chunk size</label><select id="chunkSize" value={chunkKiB} onChange={e=>{setChunkKiB(Number(e.target.value));setFileRecord(null);setDistribution({});setVerified(false);invalidateSwarm();}}>{CHUNK_SIZES.map(n=><option key={n} value={n}>{n} KB</option>)}</select></div><button className="primary-action" disabled={!pickedFile||fileBusy} onClick={prepareFile}><Split size={17}/> {fileBusy?'Processing...':'Split File & Calculate SHA-256'}</button></section>
      <section className="file-panel"><div className="panel-heading"><HardDrive size={19}/><h3>2 · File Manifest</h3></div>{fileRecord?<><div className="metric"><span>Filename</span><b>{fileRecord.name}</b></div><div className="metric"><span>Size</span><b>{formatBytes(fileRecord.size)}</b></div><div className="metric"><span>Total chunks</span><b>{fileRecord.chunks.length}</b></div><div className="hash-block"><span>ORIGINAL FILE SHA-256</span><code>{fileRecord.hash}</code></div><div className="chunk-grid">{fileRecord.chunks.map(c=><div className="chunk-pill" key={c.id} title={`Chunk ${c.id+1}: ${c.hash}`}>P{c.id+1}</div>)}</div></>:<div className="empty-state">Your file manifest will appear here after splitting.</div>}</section>
      <section className="file-panel file-wide"><div className="panel-heading"><Network size={19}/><h3>3 · Distribute Chunks to Simulated Peers</h3></div><p className="file-description">Round-robin assignment gives each chunk a primary owner and, when possible, one replica. Peer storage exists inside this browser, not on remote computers.</p><div className="peer-cards">{nodes.map(n=><div className="peer-card" key={n.id}><strong>{n.data.label}</strong><span>{(distribution[n.id]||[]).length} chunks</span><div className="chunk-grid">{(distribution[n.id]||[]).map(id=><div className="chunk-pill" key={id}>P{id+1}</div>)}</div></div>)}</div><div className="file-actions"><button className="primary-action" disabled={!fileRecord||fileBusy||!nodes.length} onClick={distribute}><Network size={16}/> Distribute Chunks</button><button disabled={!fileRecord||!Object.keys(distribution).length||fileBusy} onClick={downloadReconstructed}><Download size={16}/> Reconstruct & Download</button></div>{fileMessage&&<div className={`file-alert ${fileMessage.startsWith('Error:')?'file-error':''}`}>{verified&&<ShieldCheck size={17}/>} {fileMessage}</div>}</section></div>
      <div className="console"><div className="console-title"><Activity size={16}/> EVENT CONSOLE <span>REAL BYTES · SIMULATED PEERS</span></div><div className="console-lines">{events.map((e,i)=><div key={i}><span>›</span> {e}</div>)}</div></div>
      </>:page==='swarm'?<>
      <div className="workspace-heading"><div><h2>Live Swarm Transfer</h2><p>Collect missing real file chunks from reachable simulated peers. Every transfer follows the topology and scheduler.</p></div><div className="toolbar"><button onClick={()=>setPage('files')}><Files size={16}/> File Distribution</button><button onClick={()=>setPage('network')}><Network size={16}/> Network Studio</button></div></div>
      <div className="swarm-layout">
        <section className="file-panel"><div className="panel-heading"><Activity size={19}/><h3>1 · Configure Download</h3></div>
          <div className="metric"><span>File</span><b>{fileRecord?.name||'No file prepared'}</b></div>
          <div className="file-field"><label htmlFor="downloadPeer">Downloading peer</label><select id="downloadPeer" value={nodes.some(n=>n.id===downloader)?downloader:''} onChange={e=>{setDownloader(e.target.value);invalidateSwarm()}}><option value="" disabled>Select peer</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.data.label}</option>)}</select></div>
          <div className="file-field"><label htmlFor="pieceStrategy">Piece selection</label><select id="pieceStrategy" value={strategy} onChange={e=>{setStrategy(e.target.value);invalidateSwarm()}}><option value="rarest">Rarest first</option><option value="sequential">Sequential</option></select></div>
          <div className="file-field"><label htmlFor="speed">Simulated speed</label><select id="speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="128">128 KiB / tick</option><option value="256">256 KiB / tick</option><option value="512">512 KiB / tick</option><option value="1024">1024 KiB / tick</option></select></div>
          <div className="file-field"><label htmlFor="latency">Latency</label><select id="latency" value={latency} onChange={e=>setLatency(Number(e.target.value))}><option value="0">0 ticks</option><option value="1">1 tick</option><option value="3">3 ticks</option><option value="6">6 ticks</option></select></div>
          <div className="file-field"><label htmlFor="loss">Simulated loss</label><select id="loss" value={loss} onChange={e=>setLoss(Number(e.target.value))}><option value="0">0%</option><option value="10">10%</option><option value="25">25%</option><option value="50">50%</option></select></div>
          <button className="primary-action" disabled={!fileRecord||!Object.keys(distribution).length||!nodes.some(n=>n.id===downloader)} onClick={initializeSwarm}><RotateCcw size={16}/> Initialize / Restart Swarm</button>
          <div className="file-actions"><button className="primary-action" disabled={!swarm||!['ready','paused','blocked'].includes(swarm.status)} onClick={()=>setSwarm(s=>({...s,status:'running'}))}><Play size={16}/> Start / Resume</button><button disabled={swarm?.status!=='running'} onClick={()=>setSwarm(s=>({...s,status:'paused'}))}>Pause</button><button disabled={!swarm||swarm.status==='complete'} onClick={()=>{setSwarm(s=>{const next=tickSwarm({...s,status:'running'},fileRecord,{speedKiB:speed,latencyTicks:latency,lossPct:loss});return next.status==='running'?{...next,status:'paused'}:next})}}>Step</button></div>
          {swarmMessage&&<div className={`file-alert ${swarmMessage.startsWith('Error:')?'file-error':''}`}>{swarmMessage}</div>}
        </section>
        <section className="file-panel"><div className="panel-heading"><Network size={19}/><h3>2 · Transfer Monitor</h3></div>
          {swarm?<><div className="swarm-status">{swarm.status.toUpperCase()} · Tick {swarm.ticks}</div><div className="swarm-progress"><div style={{width:`${Math.round(100*swarm.completed.length/Math.max(1,swarm.total))}%`}}/></div><p className="file-description">{swarm.completed.length} / {swarm.total} pieces collected ({Math.round(100*swarm.completed.length/Math.max(1,swarm.total))}%)</p>
          <div className="metric"><span>Current transfer</span><b>{swarm.active?`P${swarm.active.piece+1}: ${swarm.active.source} → ${swarm.downloader}`:'Idle'}</b></div><div className="metric"><span>Transfer attempts</span><b>{swarm.attempts}</b></div><div className="metric"><span>Retries / interruptions</span><b>{swarm.retries}</b></div><div className="metric"><span>Bytes received</span><b>{formatBytes(swarm.bytes)}</b></div>
          <div className="chunk-grid">{fileRecord.chunks.map(c=><div key={c.id} className={`chunk-pill ${swarm.completed.includes(c.id)?'piece-done':swarm.active?.piece===c.id?'piece-active':'piece-missing'}`}>P{c.id+1}</div>)}</div>
          <button className="primary-action swarm-download" disabled={swarm.status!=='complete'} onClick={downloadSwarm}><ShieldCheck size={16}/> Verify SHA-256 & Download</button>
          </>:<div className="empty-state">Initialize a swarm to see live transfer progress.</div>}
        </section>
        <section className="file-panel file-wide"><div className="panel-heading"><HardDrive size={19}/><h3>3 · Peer Availability & Failure Testing</h3></div><p className="file-description">Toggle a source peer offline during a transfer. The scheduler will try another reachable owner. If no owner is reachable, the swarm blocks until you restore availability.</p>
          <div className="peer-cards">{nodes.map(n=><div className="peer-card" key={n.id}><strong>{n.data.label}</strong><span>{swarm?.owners[n.id]?.length??distribution[n.id]?.length??0} chunks {n.id===swarm?.downloader?'· DOWNLOADER':''}</span><div className="chunk-grid">{(swarm?.owners[n.id]||distribution[n.id]||[]).map(id=><div className="chunk-pill" key={id}>P{id+1}</div>)}</div><button className={`peer-toggle ${swarm?.offline.includes(n.id)?'offline':''}`} disabled={!swarm} onClick={()=>setSwarm(s=>toggleOffline(s,n.id))}>{swarm?.offline.includes(n.id)?'Offline — click to restore':'Online — click to disconnect'}</button></div>)}</div>
        </section>
        <section className="file-panel file-wide"><div className="panel-heading"><Activity size={19}/><h3>4 · Transfer Event Timeline</h3></div><div className="swarm-events">{swarm?.history.length?swarm.history.map((h,i)=><div key={i}><span>Tick {h.tick}</span> {h.message}</div>):<p className="file-description">Start the simulation to record transfer events.</p>}</div><div className="explain"><b>WHAT TO SAY</b><p>“Each file is split into real byte chunks. Our simulator checks which reachable peers own each missing chunk, models transfer time and packet loss, and reconstructs the original file after the downloader collects every chunk. The network is simulated locally, not actual device-to-device communication.”</p></div></section>
      </div>
      </>:page === 'experiments' ? (
  <ExperimentLab
    fileRecord={fileRecord}
    distribution={distribution}
    nodes={nodes}
    edges={edges}
     onResultsChange={setExperimentResults}
  />
): page === 'results' ? (
  <ResultsAnalysis
    fileRecord={fileRecord}
    distribution={distribution}
    nodes={nodes}
    edges={edges}
    swarm={swarm}
    experimentResults={experimentResults}
    onNavigate={setPage}
  />
):<div className="coming"><div className="coming-icon"><current.icon size={30}/></div><h2>{current.name}</h2><p>This workspace is planned for a later implementation phase. We are building and testing the foundation first.</p><button onClick={()=>setPage('network')}>Back to Network Studio</button></div>}
    <footer><Play size={13}/> Educational simulator — topology and peer connections are simulated locally in your browser.</footer></main>
  </div>;
}
