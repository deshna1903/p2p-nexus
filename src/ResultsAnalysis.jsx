
import React, { useState } from "react";
import {
  BarChart3,
  Network,
  Server,
  ShieldCheck,
  Presentation,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileCheck2
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

const steps = [
  {
    title: "1. Project Introduction",
    workspace: "Network Studio",
    speech:
      "Our mini-project is P2P Nexus, a hybrid peer-to-peer file sharing and network simulation laboratory. It demonstrates how files can be divided into chunks and shared across connected peers, and how this differs from centralized client-server file sharing.",
    demo:
      "Show the network topology. Add a peer, drag it, and create a connection."
  },
  {
    title: "2. File Chunking",
    workspace: "File Distribution",
    speech:
      "First, we select a real file using the browser. The application divides the file into smaller chunks and calculates SHA-256 hashes for integrity verification. These chunks can then be assigned to different simulated peers.",
    demo:
      "Upload a file, select a chunk size, split it and distribute the chunks."
  },
  {
    title: "3. Swarm Download",
    workspace: "Swarm Simulator",
    speech:
      "In peer-to-peer file sharing, the downloader does not necessarily depend on one source. It searches other connected peers for missing chunks. Our simulator supports sequential and rarest-first chunk selection and shows how chunks are collected.",
    demo:
      "Initialize the swarm, start the download and show the transfer events."
  },
  {
    title: "4. Network Failure",
    workspace: "Swarm Simulator",
    speech:
      "We can disconnect a peer during a transfer. The simulator interrupts that transfer and searches for another reachable peer with the required chunk. If no alternative source is available, the download becomes blocked.",
    demo:
      "Restart the swarm, disconnect a source peer, and observe the event log."
  },
  {
    title: "5. Client–Server Comparison",
    workspace: "Experiment Lab",
    speech:
      "In client-server architecture, the central server supplies the file. In P2P architecture, multiple peers can act as sources. We compare the two using controlled simulated conditions, including bandwidth, latency, loss and failure.",
    demo:
      "Run an experiment with all nodes online, then disable the central server and compare the results."
  },
  {
    title: "6. Conclusion",
    workspace: "Results & Analysis",
    speech:
      "Our project combines real browser-based file chunking, hashing and reconstruction with a simulated P2P network. It demonstrates chunk distribution, source selection, fault tolerance and the differences between centralized and decentralized sharing.",
    demo:
      "Show the final results and summarize the main observations."
  }
];

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="file-panel">
      <div className="panel-heading">
        <Icon size={18} />
        <h3>{label}</h3>
      </div>
      <div
        style={{
          fontSize: 27,
          fontWeight: 750,
          marginTop: 12
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ResultsAnalysis({
  fileRecord,
  distribution,
  nodes,
  edges,
  swarm,
  experimentResults,
  onNavigate
}) {
  const [presenting, setPresenting] = useState(false);
  const [step, setStep] = useState(0);

  const totalChunks = fileRecord?.chunks?.length || 0;

  const ownedPeers = Object.values(distribution || {})
    .filter((chunks) => chunks.length > 0).length;

  const collected = swarm?.completed?.length || 0;

  const complete =
    swarm?.status === "complete";

  const results = experimentResults || null;

  const chartData = results
    ? [
        {
          name: "Completion time",
          "Client–Server":
            results.server?.status === "complete"
              ? results.server.seconds
              : 0,
          "P2P":
            results.p2p?.status === "complete"
              ? results.p2p.seconds
              : 0
        },
        {
          name: "Retries",
          "Client–Server": results.server?.retries || 0,
          "P2P": results.p2p?.retries || 0
        },
        {
          name: "Sources",
          "Client–Server":
            results.server?.contributors || 0,
          "P2P": results.p2p?.contributors || 0
        }
      ]
    : [];

  return (
    <>
      <div className="workspace-heading">
        <div>
          <h2>Results & Analysis</h2>
          <p>
            Review your P2P laboratory, understand the
            outcomes, and prepare your final demonstration.
          </p>
        </div>

        <div className="toolbar">
          <button
            onClick={() => {
              setPresenting(!presenting);
              setStep(0);
            }}
          >
            <Presentation size={16} />
            {presenting
              ? "Close Presentation"
              : "Presentation Mode"}
          </button>
        </div>
      </div>

      {presenting ? (
        <div className="file-layout">
          <section className="file-panel file-wide">
            <div className="panel-heading">
              <Presentation size={20} />
              <h3>
                Guided Presentation · {step + 1} / {steps.length}
              </h3>
            </div>

            <div style={{ marginTop: 20 }}>
              <h2>{steps[step].title}</h2>

              <p
                className="file-description"
                style={{ marginTop: 14 }}
              >
                <b>WORKSPACE:</b> {steps[step].workspace}
              </p>

              <div className="explain">
                <b>WHAT TO SAY</b>
                <p>{steps[step].speech}</p>
              </div>

              <div
                className="explain"
                style={{ marginTop: 16 }}
              >
                <b>WHAT TO DEMONSTRATE</b>
                <p>{steps[step].demo}</p>
              </div>
            </div>

            <div
              className="toolbar"
              style={{ marginTop: 24 }}
            >
              <button
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <button
                onClick={() => {
                  if (onNavigate) {
                    const pages = {
                      "Network Studio": "network",
                      "File Distribution": "files",
                      "Swarm Simulator": "swarm",
                      "Experiment Lab": "experiments",
                      "Results & Analysis": "results"
                    };

                    onNavigate(
                      pages[steps[step].workspace]
                    );
                  }
                }}
              >
                Open Workspace
              </button>

              <button
                disabled={step === steps.length - 1}
                onClick={() => setStep(step + 1)}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="file-layout">
            <Stat
              label="Connected Peers"
              value={nodes.length}
              icon={Network}
            />

            <Stat
              label="Network Links"
              value={edges.length}
              icon={Server}
            />

            <Stat
              label="File Chunks"
              value={totalChunks}
              icon={FileCheck2}
            />

            <Stat
              label="Peers Holding Chunks"
              value={ownedPeers}
              icon={ShieldCheck}
            />

            <section className="file-panel file-wide">
              <div className="panel-heading">
                <BarChart3 size={19} />
                <h3>File Sharing Summary</h3>
              </div>

              <div className="metric">
                <span>Selected file</span>
                <b>{fileRecord?.name || "No file selected"}</b>
              </div>

              <div className="metric">
                <span>Chunk count</span>
                <b>{totalChunks}</b>
              </div>

              <div className="metric">
                <span>Distributed peers</span>
                <b>{ownedPeers}</b>
              </div>

              <div className="metric">
                <span>Swarm chunks collected</span>
                <b>
                  {collected} / {totalChunks}
                </b>
              </div>

              <div className="metric">
                <span>Swarm status</span>
                <b>{swarm?.status || "Not initialized"}</b>
              </div>

              {complete ? (
                <div className="file-alert">
                  <CheckCircle2 size={17} />
                  All chunks collected successfully.
                </div>
              ) : (
                <div className="file-alert">
                  <AlertTriangle size={17} />
                  Complete a swarm download to view
                  the final download status.
                </div>
              )}
            </section>

            <section className="file-panel file-wide">
              <div className="panel-heading">
                <BarChart3 size={19} />
                <h3>Client–Server vs P2P</h3>
              </div>

              {results ? (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: 320
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          opacity={0.2}
                        />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="Client–Server"
                          fill="#60a5fa"
                        />
                        <Bar
                          dataKey="P2P"
                          fill="#2edbc1"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="file-description">
                    These results are simulated. Completion
                    time is measured in modeled seconds,
                    while retries and sources are counts.
                  </p>
                </>
              ) : (
                <div className="empty-state">
                  Run an experiment in Experiment Lab
                  to generate comparison results.
                </div>
              )}
            </section>

            <section className="file-panel file-wide">
              <div className="panel-heading">
                <ShieldCheck size={19} />
                <h3>Learning Outcomes</h3>
              </div>

              <div className="explain">
                <b>WHAT THIS PROJECT DEMONSTRATES</b>
                <p>
                  1. Real file segmentation and
                  SHA-256 integrity verification.
                </p>
                <p>
                  2. Distributed chunk ownership across
                  simulated peers.
                </p>
                <p>
                  3. Sequential and rarest-first
                  piece selection.
                </p>
                <p>
                  4. Transfer interruption and recovery
                  when alternative chunk sources exist.
                </p>
                <p>
                  5. Controlled comparison between
                  Client–Server and P2P file sharing.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
