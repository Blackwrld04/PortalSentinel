import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { BlockStateStore } from "./state.js";

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sentinel-state-"));
  return {
    dir,
    store: new BlockStateStore(path.join(dir, "state.json")),
  };
}

test("missing state file loads as block 0", async () => {
  const { dir, store } = await tempStore();
  try {
    assert.equal(await store.load(), 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("save/load round-trips the last processed block", async () => {
  const { dir, store } = await tempStore();
  try {
    await store.save(12345);
    assert.equal(await store.load(), 12345);

    await store.save(12346);
    assert.equal(await store.load(), 12346);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("corrupt state file loads as block 0 instead of crashing", async () => {
  const { dir, store } = await tempStore();
  try {
    await fs.writeFile(path.join(dir, "state.json"), "{not json", "utf8");
    assert.equal(await store.load(), 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("save rejects invalid block numbers", async () => {
  const { dir, store } = await tempStore();
  try {
    await assert.rejects(() => store.save(-1));
    await assert.rejects(() => store.save(1.5));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
