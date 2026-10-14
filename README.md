# P2P Nexus — Hybrid Peer-to-Peer File Sharing & Network Simulation Lab

**An interactive, browser-based project for learning how peer-to-peer (P2P) file sharing works.**

P2P Nexus lets you design a network of peers, split a real file into chunks, distribute those chunks among simulated peers, simulate downloading the missing chunks, and compare P2P behaviour with a basic client-server model.

> **Important:** File reading, chunking, SHA-256 hashing, reconstruction, and downloading the reconstructed file happen for real inside your browser. The peers, network links, bandwidth, latency, packet loss, and peer-to-peer transfers are **simulated in one browser**. This is a learning and experimentation tool, not a real multi-device P2P file-transfer application.

## Live demo and source code

- **Live application:** https://p2p-nexus.vercel.app/
- **GitHub repository:** https://github.com/deshna1903/p2p-nexus

## 1. Project overview

### What is peer-to-peer networking?

In a traditional **client-server** system, clients request files from a central server. In a **peer-to-peer (P2P)** system, connected computers (called *peers*) can share resources with one another. A peer can both request data and provide data.

A large file can be split into smaller **chunks**. Different peers may have different chunks, so a downloader can collect the missing pieces and put them back together.

### Problem statement

Centralized file sharing may suffer from server overload, bandwidth bottlenecks, or a single point of failure. It can also be difficult to understand distributed file sharing from diagrams alone.

**P2P Nexus** addresses this educational problem by providing an interactive simulation of peer connections, chunk availability, downloads, failures, and network conditions.

### Objectives

1. Design and visualize a network of connected peers.
2. Split a real local file into chunks and calculate integrity hashes.
3. Distribute file chunks among simulated peers.
4. Reconstruct the original file and verify its integrity.
5. Simulate collecting missing chunks from available peers.
6. Experiment with bandwidth, latency, loss, and failures.
7. Compare the simulated P2P approach with a modeled client-server baseline.

## 2. Main features — the six workspaces

### A. Network Studio

This is the visual network-design workspace.

- View peers as nodes and network connections as links.
- Drag peers to rearrange the topology.
- Connect peers using the interactive diagram.
- Add or remove peers, inspect a selected peer, and reset the topology.
- Explore online/offline states and the local event display.

**Why it matters:** A network topology helps explain which peers are connected and how a network changes when peers are added, removed, or disconnected.

### B. File Distribution Lab

This workspace handles **real local file bytes** in the browser.

1. Choose a file from your computer.
2. Select a chunk size (for example, 256 KiB).
3. Split the file into smaller chunks.
4. Generate SHA-256 hashes to support integrity checks.
5. Assign chunks to simulated peers and view their availability.
6. Reassemble the chunks in the correct order.
7. Verify the reconstructed file and download it.

**Example:** A 1 MiB file split into 256 KiB chunks produces four chunks (assuming exactly 1 MiB of data).

**Why it matters:** Chunking makes it possible to describe how different peers can contribute different parts of one file.

### C. Swarm Simulator

This workspace models how a downloading peer obtains the chunks it does not yet have.

- Identify missing chunks.
- Find simulated source peers that have those chunks.
- Choose a chunk-selection strategy, such as **sequential** or **rarest-first**.
- Simulate transfers affected by bandwidth, latency, and loss.
- Observe progress, attempts, and event messages.
- Simulate an unavailable peer and retry from another source when one exists.

**Sequential:** Prefer chunks in their normal order.

**Rarest-first:** Prefer chunks with fewer available sources. This helps demonstrate why scarce pieces can be important in a distributed network.

**Note:** The current simulation models one active chunk transfer at a time; it does not perform simultaneous downloads from multiple real computers.

### D. Network Experiment Lab

Use this workspace to test different **simulated network conditions**.

| Parameter | Simple meaning | What it helps demonstrate |
| --- | --- | --- |
| Bandwidth | How much data can be transferred per unit of time | Transfer speed |
| Latency | Delay before data is received | Network responsiveness |
| Packet loss | Transfers that fail or need retrying in the model | Reliability |
| Peer failure | A simulated peer becomes unavailable | Alternate-source selection |
| Server failure | The modeled central server becomes unavailable | Dependence on a central server |

The lab uses a virtual-time simulation engine to generate repeatable experiments and compare the simulated P2P process with a simplified client-server baseline.

**Important:** These are modeled outcomes, not benchmark measurements collected from real computers or the internet.

### E. Results & Analysis

This workspace presents experiment outcomes in a clearer format.

- View experiment summary information.
- Review whether the simulated swarm completed.
- Compare P2P and client-server results using charts.
- Use the guided **Presentation Mode** to explain the project during a demonstration.

**Tip:** Run an experiment first, then open Results & Analysis to see the comparison generated from that experiment.

### F. Heatwave AI Use Case

This independent academic workspace demonstrates **Climate Intelligence for Heatwave Monitoring, Prediction, and Early Warning** through the network distribution of a sample alert.

- Select illustrative weather and risk data for Pune, Mumbai, Nagpur, Nashik, or Aurangabad and generate a warning snapshot with a unique ID and simulated creation time.
- Select a source station and distribute the warning across a fixed, bidirectional P2P topology in breadth-first steps. Only online stations receive or forward, and each station receives the alert ID once.
- Disconnect Mumbai to demonstrate the alternate route through Nashik. Disconnect Nagpur to isolate Aurangabad. Restore stations to resume a blocked run automatically.
- Switch to Client-Server Mode and toggle the central server to compare direct server deliveries with peer forwarding. Server outages stop new server deliveries; peer outages can also block P2P.
- Review delivery events, reached/waiting/unreachable stations, success percentage, simulated time, and the latest observation for each mode.
- Reset clears simulation results and restores online stations and server while retaining the generated warning. Generating another warning clears prior delivery observations. Leaving the workspace cancels its timer and starts a fresh workspace on return.

**Academic demonstration — illustrative weather and risk data, not live observations or AI predictions.** There is no weather API or AI model. The local source copy counts as reached at time zero when its station is online. Each P2P wave takes one simulated second; the preloaded central server sends to one available station per simulated second. Blocked time is excluded, and these teaching rules do not demonstrate real-world performance superiority.

The new simulation is isolated in `src/heatwaveSimulation.js`; it does not change the file-processing, swarm, or existing experiment calculations. Its dependency-free regression tests run with:

```powershell
node --test tests/heatwaveSimulation.test.mjs
```

## 3. How the project works — complete workflow

```text
                    P2P NEXUS WEB APPLICATION
                              |
                     Design Peer Network
                              |
                      Choose a Local File
                              |
                    Split File into Chunks
                              |
                     Calculate SHA-256
                              |
                 Assign Chunks to Simulated Peers
                              |
                    Choose Downloading Peer
                              |
                  Find Missing File Chunks
                              |
                 Select Available Source Peer
                              |
               Simulate Transfer / Retry / Failure
                              |
                     Collect All Chunks
                              |
                  Reconstruct Original File
                              |
                  Verify File Using SHA-256
                              |
                   View Experiment Results
```

### Example with four chunks

Suppose a file is split into `C1`, `C2`, `C3`, and `C4`.

| Peer | Example chunks available |
| --- | --- |
| Peer A | C1, C2 |
| Peer B | C2, C3 |
| Peer C | C3, C4 |
| Downloading peer | Initially missing C1–C4 |

The downloader needs all four chunks. In the simulation, it can select an available source for each missing chunk. If Peer B goes offline, C3 may still be obtainable from Peer C. But if no reachable online peer has a required chunk, the download cannot finish.

This table is an **illustrative example**, not a fixed distribution used by every run.

## 4. Network design and architecture

### Conceptual P2P topology

```text
          Peer A -------- Peer B
            |             /   |
            |            /    |
          Peer C -------- Peer D (Downloader)
```

Each peer is represented as a node, and each link represents a simulated network connection. The actual topology is editable in **Network Studio**.

### Software architecture

```text
                      React + Vite Frontend
                               |
          +--------------------+--------------------+
          |                    |                    |
     Network Studio     File Distribution      Swarm Simulator
          |                    |                    |
          +--------------------+--------------------+
                               |
                       Network Experiment Lab
                               |
                        Results & Analysis
```

The application runs in the browser. It does **not** require a database, Flask/Node backend, tracker server, or WebRTC connection for its current features.

## 5. Technologies used

| Technology | Role in P2P Nexus |
| --- | --- |
| **React.js** | Builds the interactive user interface and manages screen state. |
| **JavaScript** | Implements file processing, simulation rules, and application logic. |
| **Vite** | Runs the local development server and creates production builds. |
| **HTML and CSS** | Provide the page structure, responsive styling, and light/dark appearance. |
| **React Flow (`@xyflow/react`)** | Displays draggable peers and interactive network links. |
| **Recharts** | Displays experiment and comparison charts. |
| **Lucide React** | Provides interface icons. |
| **Web Crypto API** | Calculates SHA-256 hashes in the browser. |
| **Git and GitHub** | Track source-code changes and host the repository. |
| **Vercel** | Hosts the deployed frontend website. |

### Why SHA-256?

SHA-256 creates a fixed-length digital fingerprint (hash) from file data. If the original file and reconstructed file have the same SHA-256 hash, that provides strong evidence that their contents match.

A hash is **not encryption**: it is used here for **integrity checking**, not for hiding file contents.

## 6. Project folder structure

```text
p2p-nexus/
├── src/
│   ├── App.jsx               # Main interface and workspace navigation
│   ├── ExperimentLab.jsx     # Network experiment controls and comparisons
│   ├── ResultsAnalysis.jsx   # Charts, results and presentation guidance
│   ├── fileEngine.js         # File chunking, hashing and reconstruction
│   ├── swarmEngine.js        # Simulated peer transfers and virtual-time logic
│   ├── main.jsx              # React application entry point
│   └── styles.css            # Application styling
├── index.html                # HTML entry page
├── package.json              # Dependencies and npm scripts
├── package-lock.json         # Locked dependency versions
├── vite.config.js            # Vite configuration
├── .gitignore                # Files excluded from Git
└── README.md                 # Project documentation
```

## 7. How to run the project locally

### Requirements

- A computer with **Node.js** and **npm** installed.
- A modern web browser, such as Chrome or Edge.
- VS Code is recommended, but optional.

### Steps (Windows PowerShell)

**1. Clone the repository:**

```powershell
git clone https://github.com/deshna1903/p2p-nexus.git
cd p2p-nexus
```

**2. Install dependencies:**

```powershell
npm.cmd install
```

**3. Start the development server:**

```powershell
npm.cmd run dev
```

**4. Open the local address** shown in the terminal, normally:

```text
http://localhost:5173/
```

### Production build

```powershell
npm.cmd run build
```

This creates the production-ready `dist/` folder.

To preview the production build locally:

```powershell
npm.cmd run preview
```

## 8. How to demonstrate the project

For a short DCN presentation, use this sequence:

1. **Network Studio:** Show the peer nodes and their connections. Explain that the links represent a simulated topology.
2. **File Distribution Lab:** Upload a small file, split it, and distribute chunks among peers.
3. **File reconstruction:** Reassemble the file and show the SHA-256 integrity result.
4. **Swarm Simulator:** Select a downloading peer, start the simulated download, and show chunk progress.
5. **Peer failure:** Disconnect a source peer and explain how another peer may provide the missing chunk, if a copy is available.
6. **Experiment Lab:** Change a network parameter and run the simulation.
7. **Results & Analysis:** Show the comparison chart and summarize what changed.

For the smoothest demo, use a **small, non-sensitive test file** and run the experiment once before opening Results & Analysis.

## 9. Client-server vs P2P

| Feature | Client-server | Peer-to-peer |
| --- | --- | --- |
| Main file source | Central server | Participating peers |
| File availability | Depends on server availability | Depends on which peers and chunks remain available |
| Workload | Concentrated at the server | Can be shared among peers |
| Failure example | Server outage may interrupt access | A peer outage may be recoverable from another peer |
| In this project | Simplified modeled baseline | Simulated peer and chunk-sharing model |

**Neither model is always faster.** Performance depends on the available bandwidth, delays, failures, network topology, and how the transfer is modeled.

## 10. Outcomes and learning

By building and using P2P Nexus, the following concepts can be demonstrated:

- Peer-to-peer and client-server network architectures.
- Network topology and peer availability.
- File chunking, distribution, and reconstruction.
- Data integrity checking using SHA-256.
- Chunk selection and simulated source discovery.
- Bandwidth, latency, loss, retries, and peer failures.
- Basic experimental comparison and result visualization.

## 11. Current limitations

This section is important for understanding exactly what the project does.

- **Not a real multi-device P2P application:** Peers and transfers exist in a single browser simulation.
- **No actual network packet transfer between peers:** Bandwidth, latency, and loss are modeled values.
- **No real tracker or peer-discovery service:** Peer availability is represented by the simulator.
- **No real backend or database:** The application works as a browser-based frontend.
- **No parallel real-peer downloads:** The current swarm engine processes one simulated chunk transfer at a time.
- **Simplified comparison:** The client-server baseline is a model intended for learning, not a scientific benchmark of real networks.
- **Availability matters:** If no available peer has a needed chunk, the simulated download cannot complete.

## 12. Future improvements

- Use **WebRTC DataChannels** for actual browser-to-browser file transfer.
- Add real peer discovery and signaling.
- Transfer different chunks from multiple peers in parallel.
- Add richer network topology and routing experiments.
- Collect real transfer timing and throughput measurements.
- Add more detailed logging and exportable experiment reports.

## 13. Frequently asked questions

**Q: Is this a working project or only a design?**  
It is a working interactive web application. File processing, hashing, and reconstruction work with real local files, while network communication is simulated.

**Q: Why use P2P instead of client-server?**  
P2P demonstrates how different peers can contribute data and how alternative sources may help when one peer fails.

**Q: What happens when a peer disconnects?**  
The simulator can try another available peer that has the required chunk. If no alternative exists, completion may not be possible.

**Q: Why split a file into chunks?**  
Chunks let different peers hold or contribute different portions of a file and allow the downloader to track what is still missing.

**Q: Why use SHA-256?**  
To verify that the reconstructed file matches the original data.

**Q: Is a backend or database needed?**  
No. The current application runs in the browser and is deployed as a static frontend.

**Q: Does the chart show real internet speeds?**  
No. It shows results from a configurable simulation model.

## 14. Project information

- **Project:** P2P Nexus — Hybrid Peer-to-Peer File Sharing & Network Simulation Lab
- **Subject:** Data Communication and Networking (DCN)
- **Experiment:** No. 8 — Network Design using Simulation Software
- **Department:** Information Technology
- **Academic year:** 2026–27
- **Developer:** Deshna Shah
- **Repository:** https://github.com/deshna1903/p2p-nexus
- **Live application:** https://p2p-nexus.vercel.app/

---

**P2P Nexus makes networking concepts easier to understand by letting users see, change, and experiment with a simulated peer-to-peer file-sharing system.**
