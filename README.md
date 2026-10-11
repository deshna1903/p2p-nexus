# P2P Nexus — Hybrid File-Sharing Lab

**Phase 1 starter:** React/Vite interactive network topology studio.

## Run locally (Windows PowerShell)

```powershell
npm install
npm.cmd run dev
```

Open the URL printed by Vite (usually http://localhost:5173).

## Phase 1 features
- Dark/light mode
- Draggable peer nodes
- Connect nodes by dragging between their handles
- Add/delete peers
- Reset topology
- Inspect selected peer
- Local event console
- Five-workspace navigation scaffold

## Upcoming phases
1. **Phase 2:** Actual browser file chunking, SHA-256 hashing and reconstruction.
2. **Phase 3:** Deterministic simulation engine and animated piece transfers.
3. **Phase 4:** Network failure, bandwidth, latency, loss and experiment controls.
4. **Phase 5:** Results, validation, documentation and deployment.

**Note:** Peers, links and transfers are simulated in one browser. This is not real peer-to-peer network communication. The later file engine will process actual local bytes.
