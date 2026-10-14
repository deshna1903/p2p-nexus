import React, { useEffect, useRef, useState } from "react";
import {
  ThermometerSun,
  Droplets,
  Gauge,
  ShieldAlert,
  Radio,
  Network,
  Server,
  RotateCcw,
  Play,
  ChartNoAxesCombined,
  GraduationCap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  REGIONS,
  LINKS,
  allOnline,
  stationName,
  receivedStations,
  reachableStations,
  createRun,
  advanceRun,
  reconcileRun,
  runMetrics,
} from "./heatwaveSimulation";
import "./HeatwaveUseCase.css";

const POSITIONS = {
  pune: [100, 165],
  mumbai: [315, 65],
  nashik: [315, 270],
  nagpur: [530, 165],
  aurangabad: [745, 165],
};
const freshModel = () => ({
  online: allOnline(),
  serverOnline: true,
  run: null,
  history: {},
});

// Save an observation from the same events that power the dashboard. Previous
// modes remain visible for comparison; generating a new alert clears them.
function saveRun(model, run) {
  if (!run) return { ...model, run: null };
  const observation = {
    ...runMetrics(run, model.online, model.serverOnline),
    status: run.status,
    source: run.source,
    serverOnline: model.serverOnline,
    offline: REGIONS.filter(({ id }) => !model.online[id]).map(
      ({ name }) => name,
    ),
  };
  return {
    ...model,
    run,
    history: { ...model.history, [run.mode]: observation },
  };
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="hw-metric">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {Icon && <Icon size={22} aria-hidden="true" />}
    </div>
  );
}

function Topology({ model, source }) {
  const { run, online } = model;
  const received = receivedStations(run);
  const reachable = reachableStations(run, online, model.serverOnline);
  const activeSource = run?.source || source;
  const mode = run?.mode || "p2p";
  return (
    <div className="hw-topology">
      <svg
        viewBox="0 0 845 345"
        role="img"
        aria-labelledby="hw-topology-title hw-topology-description"
      >
        <title id="hw-topology-title">Five-station monitoring network</title>
        <desc id="hw-topology-description">
          Pune connects to Mumbai and Nashik. Both connect to Nagpur. Nagpur
          connects to Aurangabad. Dashed links have an offline endpoint. Station
          cards below provide status and disconnect controls.
        </desc>
        {LINKS.map(([a, b]) => {
          const active = online[a] && online[b];
          const used =
            mode === "p2p" &&
            run?.events.some(
              (event) =>
                (event.from === a && event.to === b) ||
                (event.from === b && event.to === a),
            );
          return (
            <line
              key={`${a}-${b}`}
              x1={POSITIONS[a][0]}
              y1={POSITIONS[a][1]}
              x2={POSITIONS[b][0]}
              y2={POSITIONS[b][1]}
              className={`hw-link ${active ? "active" : "inactive"} ${used && active ? "used" : ""}`}
            />
          );
        })}
        {REGIONS.map(({ id, name }) => {
          const [x, y] = POSITIONS[id];
          const status = received.has(id)
            ? "Received"
            : !run
              ? "Waiting"
              : reachable.has(id)
                ? "Waiting"
                : "Unreachable";
          return (
            <g
              key={id}
              transform={`translate(${x - 73}, ${y - 36})`}
              className={`hw-node ${online[id] ? "online" : "offline"} ${received.has(id) ? "received" : ""}`}
            >
              <rect width="146" height="76" rx="13" />
              <text x="73" y="24" textAnchor="middle" className="hw-node-name">
                {name}
              </text>
              <text x="73" y="43" textAnchor="middle">
                {online[id] ? "Online" : "Offline"} · {status}
              </text>
              <text
                x="73"
                y="61"
                textAnchor="middle"
                className="hw-node-source"
              >
                {id === activeSource ? "SOURCE STATION" : "MONITORING PEER"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function HeatwaveUseCase() {
  const [regionId, setRegionId] = useState("pune");
  const [source, setSource] = useState("pune");
  const [mode, setMode] = useState("p2p");
  const [alert, setAlert] = useState(null);
  const [model, setModel] = useState(freshModel);
  const alertSequence = useRef(0);
  const region = REGIONS.find(({ id }) => id === regionId);
  const { run, online, serverOnline, history } = model;
  const metrics = runMetrics(run, online, serverOnline);
  const received = receivedStations(run);
  const reachable = reachableStations(run, online, serverOnline);
  const running = run?.status === "running";

  // One timer per propagation step. Dependency changes, reset, manual stepping,
  // and workspace unmount all cancel the pending callback.
  useEffect(() => {
    if (model.run?.status !== "running") return;
    const timer = setTimeout(() => {
      setModel((current) =>
        saveRun(
          current,
          advanceRun(current.run, current.online, current.serverOnline),
        ),
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [model]);

  function generateAlert() {
    alertSequence.current += 1;
    setAlert({
      id: `HW-${crypto.randomUUID()}`,
      region: region.name,
      temperature: region.temperature,
      heatIndex: region.heatIndex,
      risk: region.risk,
      advisory: region.advisory,
      createdAt: `Scenario +${(alertSequence.current - 1) * 60} s (simulated)`,
    });
    setModel((current) => ({ ...current, run: null, history: {} }));
  }

  function startDistribution() {
    if (!alert) return;
    setModel((current) =>
      saveRun(
        current,
        createRun(alert, mode, source, current.online, current.serverOnline),
      ),
    );
  }

  function toggleStation(id) {
    setModel((current) => {
      const next = {
        ...current,
        online: { ...current.online, [id]: !current.online[id] },
      };
      return saveRun(
        next,
        reconcileRun(current.run, next.online, next.serverOnline),
      );
    });
  }

  function toggleServer() {
    setModel((current) => {
      const next = { ...current, serverOnline: !current.serverOnline };
      return saveRun(
        next,
        reconcileRun(current.run, next.online, next.serverOnline),
      );
    });
  }

  const statusMessage = !run
    ? "Ready to experiment. Generate a warning, select a source, and start distribution."
    : run.status === "complete"
      ? "Complete: all five stations have a copy of this warning."
      : run.status === "blocked"
        ? "Blocked: no new deliveries are possible. Restore a station or the server to resume automatically."
        : `Running: ${metrics.reached} of ${metrics.total} stations reached. Next step adds one simulated second.`;
  const chartData = [
    { name: "P2P", reached: history.p2p?.reached ?? null },
    { name: "Client–Server", reached: history.server?.reached ?? null },
  ];

  return (
    <div className="heatwave-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Climate Intelligence · Heatwave Early Warning</h2>
          <p>
            Explore how a sample heatwave warning travels through a monitoring
            network.
          </p>
        </div>
        <span className="hw-badge">
          <ThermometerSun size={15} /> Academic use case
        </span>
      </div>
      <div className="hw-demo-label">
        <ShieldAlert size={19} aria-hidden="true" />
        <span>
          Academic demonstration — illustrative weather and risk data, not live
          observations or AI predictions.
        </span>
      </div>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-dashboard-heading"
      >
        <div className="hw-section-top">
          <div className="panel-heading">
            <ThermometerSun size={19} />
            <h3 id="hw-dashboard-heading">1 · Heatwave Alert Dashboard</h3>
          </div>
          <label className="hw-select-label" htmlFor="hw-region">
            Weather region
            <select
              id="hw-region"
              value={regionId}
              onChange={(event) => setRegionId(event.target.value)}
            >
              {REGIONS.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="hw-metrics hw-weather">
          <MetricCard
            label={`${region.name} · Temperature`}
            value={`${region.temperature} °C`}
            icon={ThermometerSun}
          />
          <MetricCard
            label="Humidity"
            value={`${region.humidity}%`}
            icon={Droplets}
          />
          <MetricCard
            label="Illustrative heat index"
            value={`${region.heatIndex} °C`}
            icon={Gauge}
          />
          <div className="hw-metric">
            <div>
              <span>Sample heatwave risk</span>
              <strong
                className={`hw-risk hw-risk-${region.risk.toLowerCase()}`}
              >
                {region.risk}
              </strong>
            </div>
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
        </div>
        <div className="hw-advisory">
          <strong>Safety advisory</strong>
          <p>{region.advisory}</p>
        </div>
        <p className="file-description">
          The region values and risk categories are fixed teaching examples; no
          weather feed, risk classifier, or prediction model is running.
        </p>
      </section>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-warning-heading"
      >
        <div className="hw-section-top">
          <div className="panel-heading">
            <Radio size={19} />
            <h3 id="hw-warning-heading">2 · Generate Heatwave Warning</h3>
          </div>
          <button className="primary-action" onClick={generateAlert}>
            <ShieldAlert size={16} /> Generate Alert
          </button>
        </div>
        {alert ? (
          <div className="hw-warning" role="status">
            <div className="hw-section-top">
              <strong>
                {alert.region} · {alert.risk} risk warning
              </strong>
              <span className="hw-badge">Sample-data alert</span>
            </div>
            <code>{alert.id}</code>
            <p>
              {alert.temperature} °C temperature · {alert.heatIndex} °C heat
              index
            </p>
            <p>{alert.advisory}</p>
            <small>Created: {alert.createdAt}</small>
          </div>
        ) : (
          <p className="file-description">
            Generate an alert from the selected region’s sample data. Its
            snapshot stays fixed when you browse other regions.
          </p>
        )}
      </section>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-distribution-heading"
      >
        <div className="panel-heading">
          <Network size={19} />
          <h3 id="hw-distribution-heading">3 · P2P Alert Distribution</h3>
        </div>
        <div className="hw-controls">
          <label className="hw-select-label" htmlFor="hw-source">
            Source station
            <select
              id="hw-source"
              disabled={running}
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setModel((current) => ({ ...current, run: null }));
              }}
            >
              {REGIONS.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-action"
            disabled={!alert || running}
            onClick={startDistribution}
          >
            <Play size={16} />{" "}
            {mode === "p2p"
              ? "Start P2P Distribution"
              : "Start Client-Server Distribution"}
          </button>
          <button
            className="hw-button"
            disabled={!running}
            onClick={() =>
              setModel((current) =>
                saveRun(
                  current,
                  advanceRun(current.run, current.online, current.serverOnline),
                ),
              )
            }
          >
            Advance One Step
          </button>
          <button
            className="hw-button"
            onClick={() => {
              setModel(freshModel());
              setSource("pune");
              setMode("p2p");
            }}
          >
            <RotateCcw size={16} /> Reset Simulation
          </button>
        </div>
        <p className="file-description">
          P2P uses breadth-first propagation over active, bidirectional links.
          Only online holders forward. Each destination receives this alert ID
          once. Disconnecting Nagpur isolates Aurangabad; disconnecting Mumbai
          leaves a route through Nashik.
        </p>
        <div className="hw-status" role="status" aria-live="polite">
          <span className={`hw-status-pill ${run?.status || "idle"}`}>
            {run?.status || "Not started"}
          </span>
          <span>{statusMessage}</span>
        </div>
        <Topology model={model} source={source} />
        <div className="hw-legend">
          <span>
            <i className="hw-legend-active" /> Active link
          </span>
          <span>
            <i className="hw-legend-used" /> P2P delivery link
          </span>
          <span>
            <i className="hw-legend-inactive" /> Inactive link
          </span>
          <span>Received copies remain stored when a station disconnects.</span>
        </div>
        <div className="hw-stations">
          {REGIONS.map(({ id, name }) => {
            const delivery = run?.events.find((event) => event.to === id);
            const status = received.has(id)
              ? `Received at ${delivery.step} simulated s`
              : !run
                ? "Waiting for simulation"
                : reachable.has(id)
                  ? "Waiting for delivery"
                  : "Unreachable for new delivery";
            return (
              <div className="hw-station" key={id}>
                <div className="hw-section-top">
                  <strong>{name}</strong>
                  <span
                    className={`hw-availability ${online[id] ? "" : "offline"}`}
                  >
                    {online[id] ? "Online" : "Offline"}
                  </span>
                </div>
                <p>{status}</p>
                {id === (run?.source || source) && (
                  <small>Source station</small>
                )}
                <button
                  className="hw-button"
                  aria-label={`${online[id] ? "Disconnect" : "Reconnect"} ${name} station`}
                  onClick={() => toggleStation(id)}
                >
                  {online[id] ? "Disconnect Station" : "Reconnect Station"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hw-timeline">
          <h4>
            Delivery event timeline ·{" "}
            {run?.mode === "server" ? "Client–Server" : "P2P"}
          </h4>
          {run?.events.length ? (
            <ol>
              {run.events.map((event) => (
                <li key={`${event.alertId}-${event.to}`}>
                  <span>{event.step} simulated s</span>
                  {event.type === "origin"
                    ? `${stationName(event.to)} has the local source copy`
                    : `${stationName(event.from)} → ${stationName(event.to)} received the warning`}
                </li>
              ))}
            </ol>
          ) : (
            <p className="file-description">
              Delivery events appear here after distribution starts.
            </p>
          )}
        </div>
      </section>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-comparison-heading"
      >
        <div className="panel-heading">
          <Server size={19} />
          <h3 id="hw-comparison-heading">4 · Client-Server Comparison</h3>
        </div>
        <div className="hw-controls">
          <div
            className="hw-mode-buttons"
            role="group"
            aria-label="Distribution mode"
          >
            <button
              className={`hw-button ${mode === "p2p" ? "selected" : ""}`}
              aria-pressed={mode === "p2p"}
              disabled={running}
              onClick={() => {
                setMode("p2p");
                setModel((current) => ({ ...current, run: null }));
              }}
            >
              <Network size={16} /> P2P Mode
            </button>
            <button
              className={`hw-button ${mode === "server" ? "selected" : ""}`}
              aria-pressed={mode === "server"}
              disabled={running}
              onClick={() => {
                setMode("server");
                setModel((current) => ({ ...current, run: null }));
              }}
            >
              <Server size={16} /> Client-Server Mode
            </button>
          </div>
          <button
            className="hw-button"
            aria-pressed={serverOnline}
            onClick={toggleServer}
          >
            <Server size={16} /> Central Server:{" "}
            {serverOnline ? "Online" : "Offline"} ·{" "}
            {serverOnline ? "Disconnect" : "Reconnect"}
          </button>
        </div>
        <p className="file-description">
          Both modes count an online source’s local copy at time zero. The
          simplified server is preloaded with the sample warning and sends
          directly to one available station per step; peer links are unused in
          that mode. An offline server prevents new server deliveries. P2P peers
          forward without it, but can still be blocked by peer failures or a
          disconnected topology.
        </p>
        <p className="file-description">
          P2P forwards one hop per step, with parallel deliveries in a wave.
          These chosen timing rules illustrate propagation; they do not
          establish that P2P is always faster or guarantees delivery.
        </p>
      </section>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-results-heading"
      >
        <div className="panel-heading">
          <ChartNoAxesCombined size={19} />
          <h3 id="hw-results-heading">5 · Results & Analysis</h3>
        </div>
        <p className="file-description">
          {run
            ? `${run.mode === "p2p" ? "P2P" : "Client–Server"} run · ${run.alert.region} warning · source ${stationName(run.source)}`
            : "No active run. Metrics begin at zero; all five stations are waiting."}{" "}
          Reached counts include the local source copy. Unreachable counts
          describe stations without a copy that cannot currently be reached.
        </p>
        <div className="hw-metrics hw-results">
          <MetricCard label="Total monitoring stations" value={metrics.total} />
          <MetricCard label="Successfully reached" value={metrics.reached} />
          <MetricCard
            label="Unreachable stations"
            value={metrics.unreachable}
          />
          <MetricCard label="Waiting stations" value={metrics.waiting} />
          <MetricCard label="Delivery success" value={`${metrics.percent}%`} />
          <MetricCard
            label="Simulated delivery time"
            value={`${metrics.seconds} s`}
          />
          <MetricCard
            label={
              run?.mode === "server"
                ? "Server delivery events"
                : "Forwarding hop events"
            }
            value={metrics.deliveries}
          />
        </div>
        <p className="file-description">
          Each propagation step represents one simulated second. Blocked time
          and browser delays are excluded. Forwarding events count successful
          link transfers; the local source copy is not a forwarding event.
        </p>
        {Object.keys(history).length > 0 ? (
          <div className="hw-comparison-results">
            <div
              className="hw-chart"
              role="img"
              aria-label={`Reached stations comparison: P2P ${history.p2p?.reached ?? "not run"}, Client-Server ${history.server?.reached ?? "not run"}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 12, right: 16, bottom: 0, left: -15 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted)"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, REGIONS.length]}
                    allowDecimals={false}
                    stroke="var(--muted)"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      borderRadius: 8,
                    }}
                    cursor={{ fill: "var(--border)", opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="reached"
                    name="Reached stations"
                    fill="var(--accent)"
                    radius={[5, 5, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="hw-observations">
              <h4>Latest observation per mode</h4>
              {["p2p", "server"].map((key) => {
                const observation = history[key];
                return (
                  <div key={key}>
                    <strong>{key === "p2p" ? "P2P" : "Client–Server"}</strong>
                    {observation ? (
                      <>
                        <p>
                          {observation.reached}/5 reached ·{" "}
                          {observation.percent}% · {observation.seconds}{" "}
                          simulated s · {observation.status}
                        </p>
                        <small>
                          Source: {stationName(observation.source)}. Offline
                          stations: {observation.offline.join(", ") || "none"}.
                          Server:{" "}
                          {observation.serverOnline ? "online" : "offline"}.
                        </small>
                      </>
                    ) : (
                      <p>Not run for this warning.</p>
                    )}
                  </div>
                );
              })}
              <p className="file-description">
                Observations may use different conditions. Keep the source and
                peer availability the same for a controlled comparison.
                Generating a new warning or resetting clears the observations.
              </p>
            </div>
          </div>
        ) : (
          <p className="file-description">
            Run either mode to populate the comparison. A mode that has not run
            has no result.
          </p>
        )}
      </section>

      <section
        className="file-panel hw-section"
        aria-labelledby="hw-learning-heading"
      >
        <div className="panel-heading">
          <GraduationCap size={20} />
          <h3 id="hw-learning-heading">6 · AI Use Case and DCN Connection</h3>
        </div>
        <div className="explain">
          <b>CLIMATE INTELLIGENCE → NETWORK DISTRIBUTION</b>
          <p>
            Climate Intelligence focuses on heatwave monitoring, prediction, and
            early warning. This P2P Nexus experiment demonstrates how a heatwave
            alert generated by such a system could be distributed among
            connected monitoring stations. The experiment studies network
            topology, alert propagation, communication failures, and fault
            tolerance.
          </p>
        </div>
        <p className="file-description">
          The academic AI use case concerns climate monitoring and prediction.
          This workspace demonstrates its network distribution stage with sample
          data. It does not implement or evaluate an AI model, obtain live
          observations, or issue operational warnings.
        </p>
      </section>
    </div>
  );
}
