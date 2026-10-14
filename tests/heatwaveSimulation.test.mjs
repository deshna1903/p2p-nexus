import test from "node:test";
import assert from "node:assert/strict";
import {
  REGIONS,
  LINKS,
  allOnline,
  createRun,
  advanceRun,
  reconcileRun,
  receivedStations,
  reachableStations,
  runMetrics,
} from "../src/heatwaveSimulation.js";

const alert = { id: "HW-test", region: "Pune" };
function finish(run, online, serverOnline = true) {
  for (let step = 0; step < 10 && run.status === "running"; step++) {
    run = advanceRun(run, online, serverOnline);
  }
  return run;
}

test("all-online P2P delivery advances in BFS waves with event-derived metrics", () => {
  const online = allOnline();
  let run = createRun(alert, "p2p", "pune", online, true);
  assert.equal(run.events.length, 1);
  assert.equal(run.events[0].step, 0);
  run = advanceRun(run, online, true);
  assert.deepEqual([...receivedStations(run)], ["pune", "mumbai", "nashik"]);
  assert.equal(runMetrics(run, online, true).waiting, 2);
  run = finish(run, online);
  assert.equal(run.status, "complete");
  assert.deepEqual(runMetrics(run, online, true), {
    total: 5,
    reached: 5,
    waiting: 0,
    unreachable: 0,
    percent: 100,
    seconds: 3,
    deliveries: 4,
  });
  assert.equal(run.events.find((event) => event.to === "nagpur").step, 2);
});

test("a peer failure routes the warning through the alternative path", () => {
  const online = { ...allOnline(), mumbai: false };
  const run = finish(createRun(alert, "p2p", "pune", online, true), online);
  assert.equal(run.status, "blocked");
  assert.equal(runMetrics(run, online, true).reached, 4);
  assert.equal(runMetrics(run, online, true).unreachable, 1);
  assert.equal(
    run.events.find((event) => event.to === "nagpur").from,
    "nashik",
  );
  assert.ok(receivedStations(run).has("aurangabad"));
  assert.ok(
    run.events.every(
      (event) => event.from !== "mumbai" && event.to !== "mumbai",
    ),
  );
});

test("an offline bridge isolates an online station, which is never delivered through it", () => {
  const online = { ...allOnline(), nagpur: false };
  const run = finish(createRun(alert, "p2p", "pune", online, true), online);
  assert.equal(run.status, "blocked");
  assert.equal(runMetrics(run, online, true).unreachable, 2);
  assert.equal(runMetrics(run, online, true).percent, 60);
  assert.ok(!reachableStations(run, online, true).has("aurangabad"));
  assert.ok(!receivedStations(run).has("nagpur"));
  assert.ok(!receivedStations(run).has("aurangabad"));
});

test("disconnecting a received station during propagation stops forwarding from it", () => {
  const online = allOnline();
  let run = createRun(alert, "p2p", "pune", online, true);
  run = advanceRun(run, online, true);
  const failed = { ...online, mumbai: false };
  run = finish(reconcileRun(run, failed, true), failed);
  assert.equal(run.status, "complete");
  assert.equal(
    run.events.find((event) => event.to === "nagpur").from,
    "nashik",
  );
  assert.equal(run.events.filter((event) => event.to === "mumbai").length, 1);
});

test("a received offline bridge cannot forward; reconnect resumes without duplicates", () => {
  const online = allOnline();
  let run = createRun(alert, "p2p", "pune", online, true);
  run = advanceRun(advanceRun(run, online, true), online, true);
  const failed = { ...online, nagpur: false };
  run = reconcileRun(run, failed, true);
  assert.equal(run.status, "blocked");
  assert.equal(runMetrics(run, failed, true).unreachable, 1);
  assert.equal(advanceRun(run, failed, true), run);
  run = finish(reconcileRun(run, online, true), online);
  assert.equal(run.status, "complete");
  assert.equal(run.events.length, 5);
  assert.equal(
    run.events.find((event) => event.to === "aurangabad").from,
    "nagpur",
  );
});

test("restoring a station that missed the alert delivers exactly once", () => {
  const failed = { ...allOnline(), mumbai: false };
  let run = finish(createRun(alert, "p2p", "pune", failed, true), failed);
  const online = allOnline();
  run = finish(reconcileRun(run, online, true), online);
  assert.equal(run.status, "complete");
  assert.equal(runMetrics(run, online, true).deliveries, 4);
  for (const region of REGIONS)
    assert.equal(
      run.events.filter((event) => event.to === region.id).length,
      1,
    );
});

test("offline P2P source blocks initially and can originate after reconnecting", () => {
  const failed = { ...allOnline(), pune: false };
  let run = createRun(alert, "p2p", "pune", failed, true);
  assert.equal(run.status, "blocked");
  assert.equal(run.events.length, 0);
  assert.equal(runMetrics(run, failed, true).unreachable, 5);
  const online = allOnline();
  run = finish(reconcileRun(run, online, true), online);
  assert.equal(run.status, "complete");
  assert.equal(run.events[0].type, "origin");
});

test("offline server blocks new server deliveries while P2P remains independent", () => {
  const online = allOnline();
  const serverRun = createRun(alert, "server", "pune", online, false);
  assert.equal(serverRun.status, "blocked");
  assert.deepEqual(runMetrics(serverRun, online, false), {
    total: 5,
    reached: 1,
    waiting: 0,
    unreachable: 4,
    percent: 20,
    seconds: 0,
    deliveries: 0,
  });
  assert.equal(
    finish(createRun(alert, "p2p", "pune", online, false), online, false)
      .status,
    "complete",
  );
});

test("server outage during delivery prevents further events until restored", () => {
  const online = allOnline();
  let run = createRun(alert, "server", "pune", online, true);
  run = advanceRun(run, online, true);
  run = reconcileRun(run, online, false);
  assert.equal(run.status, "blocked");
  assert.equal(run.events.length, 2);
  assert.equal(advanceRun(run, online, false), run);
  run = finish(reconcileRun(run, online, true), online);
  assert.equal(run.status, "complete");
  assert.equal(run.steps, 4);
  assert.equal(run.events.length, 5);
});

test("server can reach an available station across a broken peer topology", () => {
  const failed = { ...allOnline(), nagpur: false };
  const run = finish(createRun(alert, "server", "pune", failed, true), failed);
  assert.equal(run.status, "blocked");
  assert.equal(runMetrics(run, failed, true).reached, 4);
  assert.ok(receivedStations(run).has("aurangabad"));
  assert.ok(
    run.events
      .filter((event) => event.type === "delivery")
      .every((event) => event.from === "server"),
  );
});

test("idle state and repeated runs have no stale delivery events", () => {
  const online = allOnline();
  assert.deepEqual(runMetrics(null, online, true), {
    total: 5,
    reached: 0,
    waiting: 5,
    unreachable: 0,
    percent: 0,
    seconds: 0,
    deliveries: 0,
  });
  const first = finish(createRun(alert, "p2p", "pune", online, true), online);
  const second = createRun(
    { ...alert, id: "HW-second" },
    "p2p",
    "pune",
    online,
    true,
  );
  assert.equal(first.events.length, 5);
  assert.equal(second.steps, 0);
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].alertId, "HW-second");
});

test("every source and availability combination obeys reachability and delivery rules", () => {
  // Exhaust all 32 availability patterns, five origins and both server states.
  for (let mask = 0; mask < 32; mask++) {
    const online = Object.fromEntries(
      REGIONS.map(({ id }, index) => [id, Boolean(mask & (1 << index))]),
    );
    for (const { id: source } of REGIONS) {
      for (const serverOnline of [false, true]) {
        const initial = createRun(alert, "p2p", source, online, serverOnline);
        const expected = reachableStations(initial, online, serverOnline);
        const run = finish(initial, online, serverOnline);
        assert.deepEqual(
          [...receivedStations(run)].sort(),
          [...expected].sort(),
        );
        assert.equal(run.events.length, receivedStations(run).size);
        for (const event of run.events) {
          assert.ok(online[event.to]);
          if (event.type === "delivery") {
            assert.ok(online[event.from]);
            assert.ok(
              LINKS.some(
                ([a, b]) =>
                  (a === event.from && b === event.to) ||
                  (b === event.from && a === event.to),
              ),
            );
            assert.ok(
              run.events.find((other) => other.to === event.from).step <
                event.step,
            );
          }
        }
      }
    }
  }
});
