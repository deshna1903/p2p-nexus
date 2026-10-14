// Illustrative values only. Risk and heat index are sample inputs, not predictions.
export const REGIONS = [
  {
    id: "pune",
    name: "Pune",
    temperature: 39,
    humidity: 35,
    heatIndex: 41,
    risk: "High",
    advisory:
      "Limit afternoon outdoor activity. Keep drinking water available and take breaks in shade.",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    temperature: 35,
    humidity: 70,
    heatIndex: 46,
    risk: "High",
    advisory:
      "Humid heat can feel intense. Plan outdoor work for cooler hours and use shaded rest areas.",
  },
  {
    id: "nagpur",
    name: "Nagpur",
    temperature: 44,
    humidity: 25,
    heatIndex: 45,
    risk: "Severe",
    advisory:
      "Avoid prolonged exposure to afternoon heat. Use cool indoor spaces and check on vulnerable neighbours.",
  },
  {
    id: "nashik",
    name: "Nashik",
    temperature: 36,
    humidity: 30,
    heatIndex: 36,
    risk: "Moderate",
    advisory:
      "Plan regular rest breaks outdoors, carry water, and watch for changing local conditions.",
  },
  {
    id: "aurangabad",
    name: "Aurangabad",
    temperature: 41,
    humidity: 30,
    heatIndex: 43,
    risk: "High",
    advisory:
      "Reduce strenuous outdoor activity during the hottest hours and arrange shaded breaks.",
  },
];

// Undirected diamond with a leaf: an alternate route exists to Nagpur,
// but Aurangabad is isolated when Nagpur goes offline.
export const LINKS = [
  ["pune", "mumbai"],
  ["pune", "nashik"],
  ["mumbai", "nagpur"],
  ["nashik", "nagpur"],
  ["nagpur", "aurangabad"],
];

export const allOnline = () =>
  Object.fromEntries(REGIONS.map(({ id }) => [id, true]));
export const stationName = (id) =>
  REGIONS.find((region) => region.id === id)?.name || id;
export const receivedStations = (run) =>
  new Set((run?.events || []).map((event) => event.to));

// BFS is recalculated from all online holders of this alert. A previously
// reached station keeps its copy while offline, but cannot receive or forward.
export function reachableStations(run, online, serverOnline) {
  if (!run) return new Set();
  const received = receivedStations(run);
  if (run.mode === "server") {
    return new Set(
      REGIONS.filter(
        ({ id }) =>
          online[id] && (serverOnline || received.has(id) || id === run.source),
      ).map(({ id }) => id),
    );
  }
  const visited = new Set([...received].filter((id) => online[id]));
  if (!received.size && online[run.source]) visited.add(run.source);
  const queue = [...visited];
  while (queue.length) {
    const current = queue.shift();
    for (const [a, b] of LINKS) {
      const next = a === current ? b : b === current ? a : null;
      if (next && online[next] && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

function nextDeliveries(run, online, serverOnline) {
  // IDs are tracked per destination to suppress duplicates, including cycles
  // and retries after a reconnect. Each run distributes exactly one alert.
  const received = new Set(
    run.events
      .filter((event) => event.alertId === run.alert.id)
      .map((event) => event.to),
  );
  if (!received.size && online[run.source]) {
    return [{ from: null, to: run.source, type: "origin" }];
  }
  if (run.mode === "server") {
    if (!serverOnline) return [];
    const target = REGIONS.find(({ id }) => online[id] && !received.has(id));
    return target ? [{ from: "server", to: target.id, type: "delivery" }] : [];
  }
  const deliveries = new Map();
  for (const from of received) {
    if (!online[from]) continue;
    for (const [a, b] of LINKS) {
      const to = a === from ? b : b === from ? a : null;
      if (to && online[to] && !received.has(to) && !deliveries.has(to)) {
        deliveries.set(to, { from, to, type: "delivery" });
      }
    }
  }
  return [...deliveries.values()];
}

export function reconcileRun(run, online, serverOnline) {
  if (!run) return null;
  const status =
    receivedStations(run).size === REGIONS.length
      ? "complete"
      : nextDeliveries(run, online, serverOnline).length
        ? "running"
        : "blocked";
  return { ...run, status };
}

export function createRun(alert, mode, source, online, serverOnline) {
  const events = online[source]
    ? [{ alertId: alert.id, from: null, to: source, type: "origin", step: 0 }]
    : [];
  return reconcileRun(
    { alert, mode, source, events, steps: 0, status: "running" },
    online,
    serverOnline,
  );
}

export function advanceRun(run, online, serverOnline) {
  if (!run || run.status !== "running") return run;
  const deliveries = nextDeliveries(run, online, serverOnline);
  if (!deliveries.length) return reconcileRun(run, online, serverOnline);
  const step = run.steps + 1;
  const events = deliveries.map((event) => ({
    ...event,
    alertId: run.alert.id,
    step,
  }));
  return reconcileRun(
    { ...run, steps: step, events: [...run.events, ...events] },
    online,
    serverOnline,
  );
}

export function runMetrics(run, online, serverOnline) {
  const received = receivedStations(run);
  const reachable = reachableStations(run, online, serverOnline);
  const pending = REGIONS.filter(({ id }) => !received.has(id));
  return {
    total: REGIONS.length,
    reached: received.size,
    waiting: run
      ? pending.filter(({ id }) => reachable.has(id)).length
      : REGIONS.length,
    unreachable: run
      ? pending.filter(({ id }) => !reachable.has(id)).length
      : 0,
    percent: Math.round((received.size / REGIONS.length) * 100),
    seconds: run?.steps || 0,
    deliveries:
      run?.events.filter((event) => event.type === "delivery").length || 0,
  };
}
