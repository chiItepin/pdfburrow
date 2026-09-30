import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeReleaseMetadata } from "../apps/web/scripts/releaseMetadata.mjs";

const require = createRequire(new URL("../packages/tooling/package.json", import.meta.url));
const { parse } = require("yaml");
const workflow = parse(
  await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
);

test("every new tag queues Pages delivery without replacing older pending releases", () => {
  assert.deepEqual(workflow.on, { push: { tags: ["**"] } });
  assert.equal(workflow.jobs.build.if, "${{ github.event.created && !github.event.deleted }}");
  assert.deepEqual(workflow.concurrency, {
    group: "pages-release",
    queue: "max",
    "cancel-in-progress": false,
  });
});

test("only the owner-gated deployment job receives publication permissions", () => {
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.jobs.build.permissions, {
    actions: "read",
    contents: "read",
    pages: "read",
  });
  assert.equal(workflow.jobs.build.steps[0].name, "Require the owner approval gate");
  assert.equal(workflow.jobs.build.steps[0].shell, "bash");
  assert.match(workflow.jobs.build.steps[0].run, /required_reviewers/u);
  assert.match(workflow.jobs.build.steps[0].run, /reviewer.login == "chiItepin"/u);
  const deploy = workflow.jobs.deploy;
  assert.equal(deploy.needs, "build");
  assert.equal(deploy.environment.name, "github-pages");
  assert.deepEqual(deploy.permissions, { contents: "read", pages: "write", "id-token": "write" });
  assert.ok(deploy.steps.some((step) => step.uses?.startsWith("actions/deploy-pages@")));
  assert.equal(deploy.steps.at(-1).name, "Verify the published revision");
  assert.deepEqual(deploy.steps.at(-1).env, {
    SITE_URL: "${{ steps.deployment.outputs.page_url }}",
    EXPECTED_TAG: "${{ github.ref_name }}",
    EXPECTED_COMMIT: "${{ needs.build.outputs.commit }}",
  });
});

test("the immutable tagged revision is checked before its single static artifact is uploaded", () => {
  const steps = workflow.jobs.build.steps;
  const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  assert.deepEqual(checkout.with, { ref: "${{ github.sha }}", "persist-credentials": false });
  const commands = steps
    .slice(1)
    .filter((step) => step.run)
    .map((step) => step.run);
  assert.deepEqual(commands, [
    "npm run setup",
    "npm run check",
    "apps/web/node_modules/.bin/playwright install --with-deps chromium firefox webkit",
    "npm run test:browser -- --workers=2",
    "node apps/web/scripts/releaseMetadata.mjs",
    "npm run test:privacy",
  ]);
  assert.deepEqual(steps.find((step) => step.run === "npm run test:privacy").env, {
    PDFBURROW_BASE_PATH: "${{ steps.pages.outputs.base_path }}/",
  });
  const upload = steps.at(-1);
  assert.ok(upload.uses.startsWith("actions/upload-pages-artifact@"));
  assert.deepEqual(upload.with, { path: "apps/web/dist", "retention-days": 30 });
  for (const step of steps.filter((step) =>
    ["npm run check", "npm run test:browser -- --workers=2"].includes(step.run),
  )) {
    assert.equal(step.env.PDFBURROW_SITE_ORIGIN, "${{ steps.pages.outputs.origin }}");
    assert.equal(step.env.PDFBURROW_BASE_PATH, "${{ steps.pages.outputs.base_path }}/");
  }
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps.filter((step) => step.uses)) {
      assert.match(step.uses, /^actions\/[\w-]+@[a-f0-9]{40}$/u);
    }
  }
});

test("release metadata preserves exact tag names and refuses missing provenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pdfburrow-release-"));
  const commit = "a".repeat(40);
  try {
    for (const tag of ["v1.0.0", "release/v1.0.0", "candidate-1", "quoted'$(tag)"]) {
      const value = await writeReleaseMetadata(directory, `refs/tags/${tag}`, commit);
      assert.deepEqual(value, { tag, commit });
      assert.deepEqual(JSON.parse(await readFile(join(directory, "release.json"), "utf8")), value);
    }
    for (const ref of [undefined, "refs/heads/main", "refs/tags/"]) {
      await assert.rejects(writeReleaseMetadata(directory, ref, commit), /tag reference/);
    }
    for (const sha of [undefined, "", "main", "abc123"]) {
      await assert.rejects(writeReleaseMetadata(directory, "refs/tags/v1", sha), /full commit SHA/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
