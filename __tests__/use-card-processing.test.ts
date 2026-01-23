/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useCardProcessing,
  useSlideAnimation,
  type CardProcessingState,
} from "@/components/hooks/use-card-processing";

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.();
    }, 10);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper to simulate receiving a message
  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  // Helper to simulate an error
  simulateError() {
    this.onerror?.();
  }
}

// Global mock - create a factory class that captures the instance
let capturedEventSource: MockEventSource | null = null;

class CapturedEventSource extends MockEventSource {
  constructor(url: string) {
    super(url);
    capturedEventSource = this;
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
}

// Set the global mock
(global as unknown as { EventSource: typeof CapturedEventSource }).EventSource = CapturedEventSource;

describe("useCardProcessing hook", () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    capturedEventSource = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    capturedEventSource = null;
  });

  // Helper to get the captured mock after hook renders
  const getEventSource = () => {
    if (!capturedEventSource) {
      throw new Error("EventSource not yet created");
    }
    return capturedEventSource;
  };

  describe("Initial state", () => {
    it("should start with empty processing cards", async () => {
      const { result } = renderHook(() => useCardProcessing());

      // Wait for initial connection
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.processingCards.size).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should connect when enabled", async () => {
      const { result } = renderHook(() => useCardProcessing({ enabled: true }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.isConnected).toBe(true);
    });

    it("should not connect when disabled", () => {
      const { result } = renderHook(() => useCardProcessing({ enabled: false }));

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("Processing events", () => {
    it("should add card to processingCards on processing_start", async () => {
      const { result } = renderHook(() => useCardProcessing());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing task...",
          progress: 10,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      expect(result.current.processingCards.has("task-123")).toBe(true);
      expect(result.current.isProcessing("task-123")).toBe(true);

      const state = result.current.getProcessingState("task-123");
      expect(state?.processingPhase).toBe("brainstorming");
      expect(state?.statusText).toBe("Analyzing task...");
      expect(state?.progress).toBe(10);
    });

    it("should update card on processing_update", async () => {
      const { result } = renderHook(() => useCardProcessing());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // First add the card
      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing task...",
          progress: 10,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      // Then update it
      const updateEvent = {
        type: "processing_update",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Generating ideas...",
          progress: 50,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(updateEvent);
      });

      const state = result.current.getProcessingState("task-123");
      expect(state?.statusText).toBe("Generating ideas...");
      expect(state?.progress).toBe(50);
    });

    it("should remove card on processing_complete", async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useCardProcessing({ onProcessingComplete: onComplete })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // First add the card
      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing task...",
          progress: 10,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      expect(result.current.processingCards.has("task-123")).toBe(true);

      // Then complete it
      const completeEvent = {
        type: "processing_complete",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Complete",
          progress: 100,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(completeEvent);
      });

      expect(result.current.processingCards.has("task-123")).toBe(false);
      expect(result.current.isProcessing("task-123")).toBe(false);
      expect(onComplete).toHaveBeenCalledWith(completeEvent.data);
    });

    it("should remove card and call error callback on processing_error", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useCardProcessing({ onProcessingError: onError })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // First add the card
      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing task...",
          progress: 10,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      // Then error
      const errorEvent = {
        type: "processing_error",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Failed",
          progress: 30,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          error: "API rate limit exceeded",
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(errorEvent);
      });

      expect(result.current.processingCards.has("task-123")).toBe(false);
      expect(onError).toHaveBeenCalledWith(errorEvent.data);
    });
  });

  describe("Worker list handling", () => {
    it("should initialize processing cards from worker_list", async () => {
      const { result } = renderHook(() => useCardProcessing());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const workerListEvent = {
        type: "worker_list",
        data: [
          {
            taskId: "task-1",
            taskTitle: "Task 1",
            repoName: "repo-1",
            status: "brainstorming",
            progress: 20,
            currentAction: "Generating ideas...",
            updatedAt: new Date().toISOString(),
          },
          {
            taskId: "task-2",
            taskTitle: "Task 2",
            repoName: "repo-2",
            status: "planning",
            progress: 40,
            currentAction: "Creating plan...",
            updatedAt: new Date().toISOString(),
          },
          {
            taskId: "task-3",
            taskTitle: "Task 3",
            repoName: "repo-3",
            status: "done", // Should not be included
            progress: 100,
            updatedAt: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(workerListEvent);
      });

      // Only active processing tasks should be added
      expect(result.current.processingCards.size).toBe(2);
      expect(result.current.isProcessing("task-1")).toBe(true);
      expect(result.current.isProcessing("task-2")).toBe(true);
      expect(result.current.isProcessing("task-3")).toBe(false);
    });
  });

  describe("Helper functions", () => {
    it("isProcessing should return correct value", async () => {
      const { result } = renderHook(() => useCardProcessing());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.isProcessing("task-123")).toBe(false);

      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing...",
          progress: 10,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      expect(result.current.isProcessing("task-123")).toBe(true);
      expect(result.current.isProcessing("task-456")).toBe(false);
    });

    it("getProcessingState should return correct state or undefined", async () => {
      const { result } = renderHook(() => useCardProcessing());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.getProcessingState("task-123")).toBeUndefined();

      const startEvent = {
        type: "processing_start",
        data: {
          taskId: "task-123",
          taskTitle: "Test Task",
          repoName: "test-repo",
          processingPhase: "planning",
          statusText: "Designing plan...",
          progress: 35,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        getEventSource().simulateMessage(startEvent);
      });

      const state = result.current.getProcessingState("task-123");
      expect(state).toBeDefined();
      expect(state?.taskId).toBe("task-123");
      expect(state?.processingPhase).toBe("planning");
      expect(state?.progress).toBe(35);
    });
  });
});

describe("useSlideAnimation hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start with no sliding cards", () => {
    const { result } = renderHook(() => useSlideAnimation());

    expect(result.current.slidingCards.size).toBe(0);
    expect(result.current.isSliding("task-123")).toBe(false);
  });

  it("should add card to sliding set when triggerSlide is called", () => {
    const { result } = renderHook(() => useSlideAnimation());

    act(() => {
      result.current.triggerSlide("task-123");
    });

    expect(result.current.slidingCards.has("task-123")).toBe(true);
    expect(result.current.isSliding("task-123")).toBe(true);
  });

  it("should remove card from sliding set after animation duration", () => {
    const { result } = renderHook(() => useSlideAnimation());

    act(() => {
      result.current.triggerSlide("task-123");
    });

    expect(result.current.isSliding("task-123")).toBe(true);

    // Advance time past the animation duration (400ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isSliding("task-123")).toBe(false);
    expect(result.current.slidingCards.has("task-123")).toBe(false);
  });

  it("should handle multiple sliding cards", () => {
    const { result } = renderHook(() => useSlideAnimation());

    act(() => {
      result.current.triggerSlide("task-1");
      result.current.triggerSlide("task-2");
      result.current.triggerSlide("task-3");
    });

    expect(result.current.slidingCards.size).toBe(3);
    expect(result.current.isSliding("task-1")).toBe(true);
    expect(result.current.isSliding("task-2")).toBe(true);
    expect(result.current.isSliding("task-3")).toBe(true);
  });

  it("should reset timeout when same card triggered again", () => {
    const { result } = renderHook(() => useSlideAnimation());

    act(() => {
      result.current.triggerSlide("task-123");
    });

    // Advance 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Trigger again (should reset the 400ms timer)
    act(() => {
      result.current.triggerSlide("task-123");
    });

    // Advance another 200ms (total 400ms from first trigger)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should still be sliding because timer was reset
    expect(result.current.isSliding("task-123")).toBe(true);

    // Advance another 200ms (total 400ms from second trigger)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now it should be done
    expect(result.current.isSliding("task-123")).toBe(false);
  });

  it("should cleanup timeouts on unmount", () => {
    const { result, unmount } = renderHook(() => useSlideAnimation());

    act(() => {
      result.current.triggerSlide("task-1");
      result.current.triggerSlide("task-2");
    });

    // Unmount should not throw
    unmount();

    // Advancing time after unmount should not cause issues
    act(() => {
      vi.advanceTimersByTime(500);
    });
  });
});

describe("CardProcessingState type", () => {
  it("should have all required fields", () => {
    const state: CardProcessingState = {
      taskId: "task-123",
      taskTitle: "Test Task",
      repoName: "test-repo",
      processingPhase: "brainstorming",
      statusText: "Analyzing...",
      progress: 50,
      jobId: "job-456",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(state.taskId).toBe("task-123");
    expect(state.processingPhase).toBe("brainstorming");
    expect(state.progress).toBe(50);
  });

  it("should support optional error field", () => {
    const state: CardProcessingState = {
      taskId: "task-123",
      taskTitle: "Test Task",
      repoName: "test-repo",
      processingPhase: "executing",
      statusText: "Failed",
      progress: 30,
      jobId: "job-456",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: "Execution failed: timeout",
    };

    expect(state.error).toBe("Execution failed: timeout");
  });

  it("should support all processing phases", () => {
    const phases = ["brainstorming", "planning", "executing"] as const;

    for (const phase of phases) {
      const state: CardProcessingState = {
        taskId: "task-123",
        taskTitle: "Test",
        repoName: "repo",
        processingPhase: phase,
        statusText: "Working...",
        progress: 50,
        jobId: "job",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(state.processingPhase).toBe(phase);
    }
  });
});
