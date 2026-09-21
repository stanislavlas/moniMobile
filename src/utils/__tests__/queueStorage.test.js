/**
 * Unit tests for queueStorage.js
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadQueue,
  saveQueue,
  addOperation,
  removeOperation,
  updateOperation,
  clearQueue,
  getQueueSummary,
  logConflict,
  updateSyncAttempt,
  updateSuccessfulSync,
} from "../queueStorage.js";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

describe("loadQueue", () => {
  it("returns empty queue when nothing stored", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const q = await loadQueue();
    expect(q).toEqual({ operations: [], lastSyncAttempt: null, lastSuccessfulSync: null });
  });

  it("parses stored queue", async () => {
    const stored = { operations: [{ id: "1", type: "entry.create" }], lastSyncAttempt: 100, lastSuccessfulSync: null };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const q = await loadQueue();
    expect(q.operations).toHaveLength(1);
    expect(q.lastSyncAttempt).toBe(100);
  });

  it("returns empty queue on parse error", async () => {
    AsyncStorage.getItem.mockResolvedValue("not-valid-json{{{");
    const q = await loadQueue();
    expect(q).toEqual({ operations: [], lastSyncAttempt: null, lastSuccessfulSync: null });
  });
});

describe("addOperation", () => {
  it("adds an operation with generated id and timestamp", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const op = await addOperation({ type: "entry.create", payload: { amount: 10 }, userId: "u1" });
    expect(op.id).toBeDefined();
    expect(op.type).toBe("entry.create");
    expect(op.status).toBe("pending");
    expect(op.retryCount).toBe(0);
    expect(op.userId).toBe("u1");
    expect(op.timestamp).toBeGreaterThan(0);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("throws when queue is at max size (100)", async () => {
    const ops = Array.from({ length: 100 }, (_, i) => ({ id: String(i), type: "entry.create", status: "pending" }));
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ operations: ops, lastSyncAttempt: null, lastSuccessfulSync: null }));
    await expect(addOperation({ type: "entry.create", payload: {} })).rejects.toThrow("full");
  });
});

describe("removeOperation", () => {
  it("removes operation by id", async () => {
    const stored = {
      operations: [
        { id: "a", type: "entry.create", status: "pending" },
        { id: "b", type: "entry.update", status: "pending" },
      ],
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    await removeOperation("a");
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved.operations).toHaveLength(1);
    expect(saved.operations[0].id).toBe("b");
  });
});

describe("updateOperation", () => {
  it("updates fields of an operation by id", async () => {
    const stored = {
      operations: [{ id: "x", type: "entry.create", status: "pending", retryCount: 0, error: null }],
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    await updateOperation("x", { status: "failed", retryCount: 1, error: "timeout" });
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    const op = saved.operations[0];
    expect(op.status).toBe("failed");
    expect(op.retryCount).toBe(1);
    expect(op.error).toBe("timeout");
  });
});

describe("clearQueue", () => {
  it("resets queue to empty state", async () => {
    await clearQueue();
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved.operations).toHaveLength(0);
    expect(saved.lastSyncAttempt).toBeNull();
    expect(saved.lastSuccessfulSync).toBeNull();
  });
});

describe("getQueueSummary", () => {
  it("returns correct counts by status", async () => {
    const stored = {
      operations: [
        { id: "1", status: "pending" },
        { id: "2", status: "pending" },
        { id: "3", status: "syncing" },
        { id: "4", status: "failed" },
      ],
      lastSyncAttempt: 500,
      lastSuccessfulSync: 400,
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const summary = await getQueueSummary();
    expect(summary.total).toBe(4);
    expect(summary.pending).toBe(2);
    expect(summary.syncing).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.lastSyncAttempt).toBe(500);
  });
});

describe("updateSyncAttempt / updateSuccessfulSync", () => {
  it("updates lastSyncAttempt", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await updateSyncAttempt(12345);
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved.lastSyncAttempt).toBe(12345);
  });

  it("updates lastSuccessfulSync", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await updateSuccessfulSync(99999);
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved.lastSuccessfulSync).toBe(99999);
  });
});

describe("logConflict", () => {
  it("stores a conflict record", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await logConflict({
      operationType: "entry.update",
      operationId: "op1",
      conflict: "404 not found",
      resolution: "dequeued",
    });
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].operationType).toBe("entry.update");
    expect(saved[0].resolution).toBe("dequeued");
  });

  it("caps conflicts at 20", async () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({ timestamp: i, operationType: "entry.delete" }));
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));
    await logConflict({ operationType: "entry.create", operationId: "new", conflict: "test", resolution: "dequeued" });
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(20);
    // Most recent should be first
    expect(saved[0].operationType).toBe("entry.create");
  });
});
