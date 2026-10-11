
export function makeSwarm(
  record,
  distribution,
  nodes,
  edges,
  downloader,
  strategy = "rarest"
) {
  if (!record) {
    throw new Error("Split a file first.");
  }

  if (!distribution || !Object.keys(distribution).length) {
    throw new Error("Distribute the chunks first.");
  }

  if (!nodes.some((n) => n.id === downloader)) {
    throw new Error("Choose an existing downloader.");
  }

  const owners = Object.fromEntries(
    nodes.map((n) => [
      n.id,
      [...(distribution[n.id] || [])]
    ])
  );

  return {
    downloader,
    strategy,
    owners,
    offline: [],
    completed: [...owners[downloader]],
    active: null,
    ticks: 0,
    attempts: 0,
    retries: 0,
    bytes: 0,
    status: "ready",
    history: [],
    lastEvent: "Ready to start.",
    total: record.chunks.length,
    seed: 17,
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target
    }))
  };
}

function connected(start, target, edges, offline) {
  if (offline.includes(start) || offline.includes(target)) {
    return false;
  }

  const seen = new Set([start]);
  const queue = [start];

  while (queue.length) {
    const id = queue.shift();

    if (id === target) {
      return true;
    }

    for (const edge of edges) {
      const next =
        edge.source === id
          ? edge.target
          : edge.target === id
          ? edge.source
          : null;

      if (
        next &&
        !seen.has(next) &&
        !offline.includes(next)
      ) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

function nextRandom(seed) {
  return (
    Math.imul(seed, 1664525) + 1013904223
  ) >>> 0;
}

export function tickSwarm(
  prev,
  record,
  {
    speedKiB = 512,
    latencyTicks = 1,
    lossPct = 0
  } = {}
) {
  if (!prev || prev.status !== "running") {
    return prev;
  }

  const s = {
    ...prev,
    owners: Object.fromEntries(
      Object.entries(prev.owners).map(
        ([key, value]) => [key, [...value]]
      )
    ),
    completed: [...prev.completed],
    history: [...prev.history],
    ticks: prev.ticks + 1
  };

  const note = (message) => {
    s.lastEvent = message;

    s.history = [
      {
        tick: s.ticks,
        message
      },
      ...s.history
    ].slice(0, 80);
  };

  if (s.offline.includes(s.downloader)) {
    s.status = "blocked";

    note(
      "Downloader is offline. Bring it back online to continue."
    );

    return s;
  }

  if (s.completed.length >= s.total) {
    s.status = "complete";
    return s;
  }

  // Process an active chunk transfer.
  if (s.active) {
    const active = { ...s.active };

    if (
      s.offline.includes(active.source) ||
      !connected(
        active.source,
        s.downloader,
        s.edges,
        s.offline
      )
    ) {
      s.active = null;
      s.retries++;

      note(
        `Peer ${active.source} disconnected: ` +
        `P${active.piece + 1} transfer interrupted; ` +
        "searching alternative."
      );

      return s;
    }

    if (active.latency > 0) {
      active.latency--;
      s.active = active;
      return s;
    }

    active.remaining = Math.max(
      0,
      active.remaining - Math.max(1, speedKiB) * 1024
    );

    if (active.remaining > 0) {
      s.active = active;
      return s;
    }

    // Deterministic simulated packet loss.
    s.seed = nextRandom(s.seed);
    s.attempts++;

    if ((s.seed % 10000) / 100 < lossPct) {
      s.retries++;
      s.active = null;

      note(
        `Simulated loss: P${active.piece + 1} ` +
        `from ${active.source} failed. Retrying.`
      );

      return s;
    }

    // Successful transfer.
    s.completed.push(active.piece);

    s.owners[s.downloader].push(active.piece);

    s.bytes += record.chunks[active.piece].size;

    s.active = null;

    note(
      `P${active.piece + 1} received from ` +
      `${active.source} → ${s.downloader} ` +
      `(${s.completed.length}/${s.total}).`
    );

    if (s.completed.length === s.total) {
      s.status = "complete";

      note(
        `Download complete! All ${s.total} chunks collected.`
      );
    }

    return s;
  }

  // Find chunks the downloader does not have.
  const missing = record.chunks
    .map((chunk) => chunk.id)
    .filter((id) => !s.completed.includes(id));

  // Find reachable peers that own each missing chunk.
  const options = missing
    .map((piece) => ({
      piece,
      sources: Object.entries(s.owners)
        .filter(([id, ids]) => {
          return (
            id !== s.downloader &&
            ids.includes(piece) &&
            connected(
              id,
              s.downloader,
              s.edges,
              s.offline
            )
          );
        })
        .map(([id]) => id)
    }))
    .filter((option) => option.sources.length > 0);

  if (!options.length) {
    s.status = "blocked";

    note(
      "No reachable peer has the remaining chunks. " +
      "Restore a link or peer."
    );

    return s;
  }

  // Select the next piece.
  options.sort((a, b) => {
    if (s.strategy === "rarest") {
      return (
        a.sources.length - b.sources.length ||
        a.piece - b.piece
      );
    }

    return a.piece - b.piece;
  });

  const chosen = options[0];

  const source = [...chosen.sources].sort()[0];

  s.active = {
    piece: chosen.piece,
    source,
    remaining: record.chunks[chosen.piece].size,
    latency: Math.max(0, latencyTicks)
  };

  note(
    `Request P${chosen.piece + 1} from ${source} ` +
    `(${s.strategy === "rarest" ? "rarest-first" : "sequential"}).`
  );

  return s;
}

export function toggleOffline(prev, peer) {
  if (!prev) {
    return prev;
  }

  const offline = prev.offline.includes(peer)
    ? prev.offline.filter((id) => id !== peer)
    : [...prev.offline, peer];

  return {
    ...prev,
    offline,
    status:
      prev.status === "blocked"
        ? "paused"
        : prev.status,
    lastEvent:
      `Peer ${peer} ` +
      `${offline.includes(peer) ? "offline" : "online"}.`
  };
}
