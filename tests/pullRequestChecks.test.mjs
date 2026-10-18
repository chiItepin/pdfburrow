import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pull requests run repository checks without deployment permissions or persisted credentials", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/checks.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /^on:\n  pull_request:\s*$/m);
  assert.match(workflow, /^permissions:\n  contents: read\s*$/m);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /run: npm run setup/);
  assert.match(workflow, /run: npm run check/);
  assert.doesNotMatch(workflow, /pull_request_target|write|environment:|deploy-pages|secrets\./);
  const actions = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
  assert.equal(actions.length, 2);
  for (const action of actions) {
    assert.match(action, /^actions\/(checkout|setup-node)@[a-f0-9]{40}$/);
  }
});
