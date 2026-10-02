import type { CaptureRun } from "../contracts/models";

export interface CaptureArtifact {
  id: string;
  runId: string;
  name: string;
  blob: Blob;
  sourceUrl?: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed")),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      { once: true },
    );
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      { once: true },
    );
  });
}

export class CaptureDatabase {
  readonly #name: string;
  #database: Promise<IDBDatabase> | undefined;

  constructor(name = "scrapeyy-captures") {
    this.#name = name;
  }

  #open(): Promise<IDBDatabase> {
    if (!this.#database) {
      this.#database = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.#name, 1);
        request.addEventListener("upgradeneeded", () => {
          const database = request.result;
          const runs = database.createObjectStore("runs", { keyPath: "id" });
          runs.createIndex("recipeId", "recipeId");
          runs.createIndex("completedAt", "completedAt");
          const artifacts = database.createObjectStore("artifacts", {
            keyPath: "id",
          });
          artifacts.createIndex("runId", "runId");
        });
        request.addEventListener("success", () => resolve(request.result), {
          once: true,
        });
        request.addEventListener(
          "error",
          () => reject(request.error ?? new Error("Could not open capture database")),
          { once: true },
        );
      });
    }
    return this.#database;
  }

  async putRun(run: CaptureRun): Promise<void> {
    const transaction = (await this.#open()).transaction("runs", "readwrite");
    transaction.objectStore("runs").put(run);
    await transactionComplete(transaction);
  }

  async putRunWithArtifacts(run: CaptureRun, artifacts: CaptureArtifact[]): Promise<void> {
    if (artifacts.some((artifact) => artifact.runId !== run.id)) throw new Error("Capture artifact does not belong to this run");
    const transaction = (await this.#open()).transaction(["runs", "artifacts"], "readwrite");
    const complete = transactionComplete(transaction);
    try {
      transaction.objectStore("runs").put(run);
      for (const artifact of artifacts) transaction.objectStore("artifacts").put(artifact);
    } catch (error) {
      transaction.abort();
      await complete.catch(() => undefined);
      throw error;
    }
    await complete;
  }

  async getRun(id: string): Promise<CaptureRun | undefined> {
    const transaction = (await this.#open()).transaction("runs", "readonly");
    const result = await requestResult(
      transaction.objectStore("runs").get(id) as IDBRequest<
        CaptureRun | undefined
      >,
    );
    await transactionComplete(transaction);
    return result;
  }

  async listRuns(): Promise<CaptureRun[]> {
    const transaction = (await this.#open()).transaction("runs", "readonly");
    const result = await requestResult(
      transaction.objectStore("runs").getAll() as IDBRequest<CaptureRun[]>,
    );
    await transactionComplete(transaction);
    return result;
  }

  async deleteRun(id: string): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(
      ["runs", "artifacts"],
      "readwrite",
    );
    transaction.objectStore("runs").delete(id);
    const artifactStore = transaction.objectStore("artifacts");
    const range = IDBKeyRange.only(id);
    const cursor = artifactStore.index("runId").openKeyCursor(range);
    cursor.addEventListener("success", () => {
      const result = cursor.result;
      if (result) {
        artifactStore.delete(result.primaryKey);
        result.continue();
      }
    });
    await transactionComplete(transaction);
  }

  async clearUnpinnedRuns(): Promise<number> {
    const unpinned = (await this.listRuns()).filter((run) => !run.pinned);
    await Promise.all(unpinned.map((run) => this.deleteRun(run.id)));
    return unpinned.length;
  }

  async putArtifact(artifact: CaptureArtifact): Promise<void> {
    const transaction = (await this.#open()).transaction(
      "artifacts",
      "readwrite",
    );
    transaction.objectStore("artifacts").put(artifact);
    await transactionComplete(transaction);
  }

  async getArtifact(id: string): Promise<CaptureArtifact | undefined> {
    const transaction = (await this.#open()).transaction(
      "artifacts",
      "readonly",
    );
    const result = await requestResult(
      transaction.objectStore("artifacts").get(id) as IDBRequest<
        CaptureArtifact | undefined
      >,
    );
    await transactionComplete(transaction);
    return result;
  }

  async listArtifacts(runId: string): Promise<CaptureArtifact[]> {
    const transaction = (await this.#open()).transaction(
      "artifacts",
      "readonly",
    );
    const result = await requestResult(
      transaction.objectStore("artifacts").index("runId").getAll(runId) as
        IDBRequest<CaptureArtifact[]>,
    );
    await transactionComplete(transaction);
    return result;
  }

  async delete(): Promise<void> {
    if (this.#database) {
      (await this.#database).close();
      this.#database = undefined;
    }
    await requestResult(indexedDB.deleteDatabase(this.#name));
  }
}
