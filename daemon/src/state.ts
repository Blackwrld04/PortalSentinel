import fs from "node:fs/promises";
import path from "node:path";

/**
 * Persists the last fully processed block so a daemon restart neither replays old
 * blocks (duplicate alerts/defenses) nor silently skips the gap.
 *
 * Writes are atomic: write a temp file, then rename over the real one.
 */
export class BlockStateStore {
  private readonly file: string;

  constructor(file = process.env.STATE_FILE || path.join(process.cwd(), ".sentinel-state.json")) {
    this.file = file;
  }

  public async load(): Promise<number> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as { lastScannedBlock?: unknown };
      const value = Number(parsed.lastScannedBlock);
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  public async save(lastScannedBlock: number): Promise<void> {
    if (!Number.isSafeInteger(lastScannedBlock) || lastScannedBlock < 0) {
      throw new Error(`Invalid block number: ${lastScannedBlock}`);
    }

    const dir = path.dirname(this.file);
    await fs.mkdir(dir, { recursive: true });

    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(
      tmp,
      JSON.stringify({ lastScannedBlock, updatedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
    await fs.rename(tmp, this.file);
  }
}
