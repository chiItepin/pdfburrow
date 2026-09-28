import assert from "node:assert/strict";
import test from "node:test";
import { runWorker } from "../packages/pdf-engine/src/workerClient.ts";

test("worker client terminates before cancellation settles and ignores captured late callbacks", async (t) => {
  const instances = [];
  const oldWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: class {
      stopped = false;
      constructor() {
        instances.push(this);
      }
      postMessage() {}
      terminate() {
        this.stopped = true;
      }
    },
  });
  t.after(() => {
    if (oldWorker) Object.defineProperty(globalThis, "Worker", oldWorker);
    else delete globalThis.Worker;
  });
  const controller = new AbortController();
  const progress = [];
  const promise = runWorker(
    new URL("https://local.invalid/worker.js"),
    "test",
    {},
    {
      signal: controller.signal,
      onProgress: (value) => progress.push(value),
    },
  );
  const worker = instances[0];
  const lateMessage = worker.onmessage;
  controller.abort();
  assert.equal(worker.stopped, true);
  lateMessage({ data: { type: "progress", progress: { completed: 1 } } });
  lateMessage({ data: { type: "result", result: { kind: "success", value: "stale" } } });
  assert.deepEqual(await promise, { kind: "cancelled" });
  assert.deepEqual(progress, []);
  assert.equal(worker.onmessage, null);

  const second = runWorker(new URL("https://local.invalid/worker.js"), "test", {}, {});
  instances[1].onmessageerror();
  assert.equal((await second).kind, "failure");
  assert.equal(instances[1].stopped, true);
  assert.deepEqual(
    await runWorker(
      new URL("https://local.invalid/worker.js"),
      "test",
      {},
      { signal: controller.signal },
    ),
    { kind: "cancelled" },
  );
  assert.equal(instances.length, 2);
});
