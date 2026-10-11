
import React, { useMemo, useState } from "react";
import {
  FlaskConical,
  Play,
  RotateCcw,
  Server,
  Network,
  AlertTriangle,
  CheckCircle2
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

import { makeSwarm, tickSwarm } from "./swarmEngine";

const TICK_SECONDS = 0.25;

function canReach(source, target, edges, offline) {
  if (offline.includes(source) || offline.includes(target)) {
    return false;
  }

  const visited = new Set([source]);
  const queue = [source];

  while (queue.length) {
    const current = queue.shift();

    if (current === target) return true;

    for (const edge of edges) {
      const next =
        edge.source === current
          ? edge.target
          : edge.target === current
          ? edge.source
          : null;

      if (
        next &&
        !visited.has(next) &&
        !offline.includes(next)
      ) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

// Run the existing P2P engine using a deterministic virtual clock.
function simulateP2P({
  record,
  distribution,
  nodes,
  edges,
  downloader,
  strategy,
  speed,
  latency,
  loss,
  offlinePeer
}) {
  let swarm = makeSwarm(
    record,
    distribution,
    nodes,
    edges,
    downloader,
    strategy
  );

  if (offlinePeer !== "none") {
    swarm = {
      ...swarm,
      offline: [offlinePeer]
    };
  }

  swarm = {
    ...swarm,
    status: "running"
  };

  const initialPieces = swarm.completed.length;
  const contributors = new Set();

  let guard = 0;

  while (swarm.status === "running" && guard < 100000) {
    const before = swarm.active;

    const next = tickSwarm(swarm, record, {
      speedKiB: speed,
      latencyTicks: latency,
      lossPct: loss
    });

    if (
      before &&
      next.completed.length > swarm.completed.length
    ) {
      contributors.add(before.source);
    }

    swarm = next;
    guard++;
  }

  return {
    status:
      guard >= 100000 ? "limit" : swarm.status,
    ticks: swarm.ticks,
    seconds: Number(
      (swarm.ticks * TICK_SECONDS).toFixed(2)
    ),
    completed: swarm.completed.length,
    total: swarm.total,
    downloaded: swarm.completed.length - initialPieces,
    retries: swarm.retries,
    attempts: swarm.attempts,
    contributors: contributors.size
  };
}

// Simplified centralized-server baseline.
// Uses the same file size, speed, latency and deterministic
// loss generator, but one central source.
function simulateServer({
  record,
  distribution,
  downloader,
  speed,
  latency,
  loss,
  serverOffline
}) {
  const existing = new Set(distribution[downloader] || []);

  if (serverOffline) {
    return {
      status: "blocked",
      ticks: 0,
      seconds: 0,
      completed: existing.size,
      total: record.chunks.length,
      retries: 0,
      attempts: 0,
      contributors: 0
    };
  }

  let ticks = 0;
  let retries = 0;
  let attempts = 0;
  let seed = 17;
  let completed = existing.size;

  for (const chunk of record.chunks) {
    if (existing.has(chunk.id)) continue;

    let success = false;

    while (!success && ticks < 100000) {
      ticks +=
        1 +
        Math.max(0, latency) +
        Math.ceil(
          chunk.size / (Math.max(1, speed) * 1024)
        );

      seed = (
        Math.imul(seed, 1664525) + 1013904223
      ) >>> 0;

      attempts++;

      if ((seed % 10000) / 100 < loss) {
        retries++;
      } else {
        success = true;
        completed++;
      }
    }

    if (!success) break;
  }

  return {
    status:
      completed === record.chunks.length
        ? "complete"
        : "limit",
    ticks,
    seconds: Number(
      (ticks * TICK_SECONDS).toFixed(2)
    ),
    completed,
    total: record.chunks.length,
    retries,
    attempts,
    contributors: completed > existing.size ? 1 : 0
  };
}

function ResultCard({ title, result }) {
  if (!result) return null;

  const success = result.status === "complete";

  return (
    <section className="file-panel">
      <div className="panel-heading">
        {title === "Client–Server" ? (
          <Server size={19} />
        ) : (
          <Network size={19} />
        )}
        <h3>{title}</h3>
      </div>

      <div
        className="file-alert"
        style={{
          color: success ? "var(--accent)" : "#f5a56c"
        }}
      >
        {success ? (
          <CheckCircle2 size={17} />
        ) : (
          <AlertTriangle size={17} />
        )}
        {success
          ? "Download completed"
          : result.status === "blocked"
          ? "Download blocked"
          : "Simulation limit reached"}
      </div>

      <div className="metric">
        <span>Simulated completion time</span>
        <b>
          {success
            ? `${result.seconds} seconds`
            : "Not completed"}
        </b>
      </div>

      <div className="metric">
        <span>Chunks collected</span>
        <b>
          {result.completed} / {result.total}
        </b>
      </div>

      <div className="metric">
        <span>Transfer attempts</span>
        <b>{result.attempts}</b>
      </div>

      <div className="metric">
        <span>Retries / interruptions</span>
        <b>{result.retries}</b>
      </div>

      <div className="metric">
        <span>Contributing sources</span>
        <b>{result.contributors}</b>
      </div>
    </section>
  );
}

export default function ExperimentLab({
  fileRecord,
  distribution,
  nodes,
  edges,
  onResultsChange
}) {
  const [downloader, setDownloader] = useState("D");
  const [strategy, setStrategy] = useState("rarest");
  const [speed, setSpeed] = useState(256);
  const [latency, setLatency] = useState(2);
  const [loss, setLoss] = useState(0);
  const [offlinePeer, setOfflinePeer] = useState("none");
  const [serverOffline, setServerOffline] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const ready =
    fileRecord &&
    Object.keys(distribution).length > 0 &&
    nodes.some((node) => node.id === downloader);

  const reachableSources = useMemo(() => {
    if (!ready) return 0;

    const offline =
      offlinePeer === "none" ? [] : [offlinePeer];

    return nodes.filter((node) => {
      return (
        node.id !== downloader &&
        canReach(
          node.id,
          downloader,
          edges,
          offline
        )
      );
    }).length;
  }, [
    ready,
    nodes,
    edges,
    downloader,
    offlinePeer
  ]);

  function runExperiment() {
    setError("");
    setResults(null);

    if (!ready) {
      setError(
        "Upload, split and distribute a file before running experiments."
      );
      return;
    }

    try {
      const args = {
        record: fileRecord,
        distribution,
        nodes,
        edges,
        downloader,
        strategy,
        speed,
        latency,
        loss
      };

      const p2p = simulateP2P({
        ...args,
        offlinePeer
      });

      const server = simulateServer({
        ...args,
        serverOffline
      });

      const newResults = { p2p, server };

setResults(newResults);
onResultsChange?.(newResults);
    } catch (err) {
      setError(err.message);
    }
  }

  function resetControls() {
    setSpeed(256);
    setLatency(2);
    setLoss(0);
    setStrategy("rarest");
    setOfflinePeer("none");
    setServerOffline(false);
    setResults(null);
    setError("");
  }

  const chartData = results
    ? [
        {
          name: "Completion time",
          "Client–Server":
            results.server.status === "complete"
              ? results.server.seconds
              : 0,
          "P2P":
            results.p2p.status === "complete"
              ? results.p2p.seconds
              : 0
        },
        {
          name: "Retries",
          "Client–Server": results.server.retries,
          "P2P": results.p2p.retries
        },
        {
          name: "Sources",
          "Client–Server": results.server.contributors,
          "P2P": results.p2p.contributors
        }
      ]
    : [];

  return (
    <>
      <div className="workspace-heading">
        <div>
          <h2>Network Experiment Lab</h2>
          <p>
            Compare centralized and distributed file sharing
            under controlled simulated network conditions.
          </p>
        </div>
        <div className="toolbar">
          <button onClick={runExperiment} disabled={!ready}>
            <Play size={16} />
            Run Experiment
          </button>
          <button onClick={resetControls}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="file-layout">
        <section className="file-panel">
          <div className="panel-heading">
            <FlaskConical size={19} />
            <h3>1 · Experiment Controls</h3>
          </div>

          <div className="metric">
            <span>File</span>
            <b>{fileRecord?.name || "Not prepared"}</b>
          </div>

          <div className="metric">
            <span>Chunks</span>
            <b>{fileRecord?.chunks.length || 0}</b>
          </div>

          <div className="file-field">
            <label>Downloading peer</label>
            <select
              value={downloader}
              onChange={(e) => {
                setDownloader(e.target.value);
                setResults(null);
              }}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.data.label}
                </option>
              ))}
            </select>
          </div>

          <div className="file-field">
            <label>Piece strategy</label>
            <select
              value={strategy}
              onChange={(e) => {
                setStrategy(e.target.value);
                setResults(null);
              }}
            >
              <option value="rarest">Rarest first</option>
              <option value="sequential">Sequential</option>
            </select>
          </div>

          <div className="file-field">
            <label>Bandwidth</label>
            <select
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
                setResults(null);
              }}
            >
              <option value={64}>64 KiB / tick</option>
              <option value={128}>128 KiB / tick</option>
              <option value={256}>256 KiB / tick</option>
              <option value={512}>512 KiB / tick</option>
              <option value={1024}>1024 KiB / tick</option>
            </select>
          </div>

          <div className="file-field">
            <label>Latency</label>
            <select
              value={latency}
              onChange={(e) => {
                setLatency(Number(e.target.value));
                setResults(null);
              }}
            >
              <option value={0}>0 ticks</option>
              <option value={1}>1 tick</option>
              <option value={2}>2 ticks</option>
              <option value={4}>4 ticks</option>
              <option value={8}>8 ticks</option>
            </select>
          </div>

          <div className="file-field">
            <label>Simulated loss</label>
            <select
              value={loss}
              onChange={(e) => {
                setLoss(Number(e.target.value));
                setResults(null);
              }}
            >
              <option value={0}>0%</option>
              <option value={10}>10%</option>
              <option value={25}>25%</option>
              <option value={50}>50%</option>
            </select>
          </div>
        </section>

        <section className="file-panel">
          <div className="panel-heading">
            <AlertTriangle size={19} />
            <h3>2 · Failure Simulation</h3>
          </div>

          <p className="file-description">
            Disconnect a P2P peer or disable the central
            server to compare fault tolerance.
          </p>

          <div className="file-field">
            <label>P2P peer failure</label>
            <select
              value={offlinePeer}
              onChange={(e) => {
                setOfflinePeer(e.target.value);
                setResults(null);
              }}
            >
              <option value="none">All peers online</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  Disconnect {node.data.label}
                </option>
              ))}
            </select>
          </div>

          <div className="file-field">
            <label>Central server</label>
            <select
              value={serverOffline ? "offline" : "online"}
              onChange={(e) => {
                setServerOffline(
                  e.target.value === "offline"
                );
                setResults(null);
              }}
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="metric">
            <span>Reachable P2P sources</span>
            <b>{reachableSources}</b>
          </div>

          <div className="metric">
            <span>Topology peers</span>
            <b>{nodes.length}</b>
          </div>

          <div className="metric">
            <span>Network links</span>
            <b>{edges.length}</b>
          </div>

          <div className="explain" style={{ marginTop: 24 }}>
            <b>EXPERIMENT IDEA</b>
            <p>
              First run with all nodes online. Then disconnect
              one source peer and run again. Finally disable
              the central server and compare the outcomes.
            </p>
          </div>
        </section>

        {error && (
          <section className="file-panel file-wide">
            <div className="file-alert file-error">
              {error}
            </div>
          </section>
        )}

        {!ready && (
          <section className="file-panel file-wide">
            <div className="empty-state">
              Go to File Distribution, split a real file,
              and distribute its chunks first.
            </div>
          </section>
        )}

        {results && (
          <>
            <ResultCard
              title="Client–Server"
              result={results.server}
            />

            <ResultCard
              title="P2P"
              result={results.p2p}
            />

            <section className="file-panel file-wide">
              <div className="panel-heading">
                <FlaskConical size={19} />
                <h3>3 · Experiment Comparison</h3>
              </div>

              <p className="file-description">
                These are modeled results, not measured
                internet speeds. Completion times are in
                simulated seconds. A zero bar for completion
                time may mean the download was blocked;
                check the status cards above.
              </p>

              <div style={{ width: "100%", height: 310 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#64748b"
                      opacity={0.2}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="Client–Server"
                      fill="#60a5fa"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="P2P"
                      fill="#2edbc1"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="file-description">
                Each category uses a different unit:
                completion time (seconds), retries (count),
                and sources (count). Compare the bars
                within each category, not across categories.
              </p>
            </section>

            <section className="file-panel file-wide">
              <div className="explain">
                <b>WHAT TO SAY TO YOUR PROFESSOR</b>
                <p>
                  “In the Client–Server model, the central
                  server supplies the missing chunks.
                  In our P2P model, the downloader searches
                  connected peers for the required chunks.
                  We can simulate peer failures, latency,
                  bandwidth and transfer loss, then compare
                  the modeled results. If a peer disconnects,
                  another peer may still have the chunk.
                  But if the only source is unavailable,
                  the P2P download can also fail.”
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
