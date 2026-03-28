"use client";

import { useState, useCallback } from "react";

interface TestResult {
  readonly test: string;
  readonly status: number;
  readonly blocked: boolean;
  readonly time_ms: number;
  readonly headers?: Record<string, string>;
  readonly dataReceived?: boolean;
  readonly sampleData?: string;
  readonly error?: string;
}

interface TestState {
  readonly vercel: TestResult | null;
  readonly railway: TestResult | null;
  readonly vercelLoading: boolean;
  readonly railwayLoading: boolean;
}

const TESTS = [
  { id: "swiggy-basic", label: "Swiggy Homepage" },
  { id: "swiggy-api", label: "Swiggy Restaurant API" },
  { id: "swiggy-search", label: "Swiggy Search API" },
  { id: "zomato-basic", label: "Zomato Homepage" },
  { id: "zomato-api", label: "Zomato Search API" },
] as const;

const INITIAL_STATE: TestState = {
  vercel: null,
  railway: null,
  vercelLoading: false,
  railwayLoading: false,
};

function StatusBadge({ result, loading }: { readonly result: TestResult | null; readonly loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--muted-foreground)]" />
        Testing...
      </span>
    );
  }

  if (!result) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1 text-xs text-[var(--muted-foreground-2)]">
        Not tested
      </span>
    );
  }

  if (result.blocked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400">
        BLOCKED {result.status > 0 ? `(${result.status})` : ""} — {result.time_ms}ms
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400">
      OK ({result.status}) — {result.time_ms}ms
    </span>
  );
}

export default function TestPage() {
  const [results, setResults] = useState<Record<string, TestState>>(
    () => Object.fromEntries(TESTS.map((t) => [t.id, { ...INITIAL_STATE }])),
  );

  const updateResult = useCallback(
    (testId: string, update: Partial<TestState>) => {
      setResults((prev) => ({
        ...prev,
        [testId]: { ...prev[testId], ...update },
      }));
    },
    [],
  );

  const fetchTest = useCallback(
    async (testId: string, source: "vercel" | "railway") => {
      const loadingKey = source === "vercel" ? "vercelLoading" : "railwayLoading";
      updateResult(testId, { [loadingKey]: true, [source]: null });

      try {
        const path =
          source === "vercel"
            ? `/api/test-${testId}`
            : `/api/test-railway?test=${testId}`;
        const res = await fetch(path);
        const json = await res.json();
        updateResult(testId, { [source]: json.data, [loadingKey]: false });
      } catch (err) {
        updateResult(testId, {
          [source]: {
            test: testId,
            status: 0,
            blocked: true,
            time_ms: 0,
            error: err instanceof Error ? err.message : "Fetch failed",
          },
          [loadingKey]: false,
        });
      }
    },
    [updateResult],
  );

  const runSingleTest = useCallback(
    async (testId: string) => {
      await Promise.all([
        fetchTest(testId, "vercel"),
        fetchTest(testId, "railway"),
      ]);
    },
    [fetchTest],
  );

  const runAllTests = useCallback(async () => {
    await Promise.all(TESTS.map((t) => runSingleTest(t.id)));
  }, [runSingleTest]);

  const anyLoading = Object.values(results).some(
    (r) => r.vercelLoading || r.railwayLoading,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          BestBite — Server API Access Test
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Test if Swiggy and Zomato APIs are accessible from Vercel and Railway servers
        </p>
      </div>

      {/* Run All button */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={runAllTests}
          disabled={anyLoading}
          className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {anyLoading ? "Running Tests..." : "Run All Tests"}
        </button>
      </div>

      {/* Test cards */}
      <div className="space-y-4">
        {TESTS.map((test, index) => {
          const state = results[test.id];
          return (
            <div
              key={test.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-medium text-[var(--muted-foreground)]">
                    {index + 1}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {test.label}
                  </span>
                </div>
                <button
                  onClick={() => runSingleTest(test.id)}
                  disabled={state.vercelLoading || state.railwayLoading}
                  className="rounded-md bg-[var(--accent-muted)] px-4 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
                >
                  Test
                </button>
              </div>

              {/* Results row */}
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground-2)]">
                    Vercel
                  </p>
                  <StatusBadge result={state.vercel} loading={state.vercelLoading} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground-2)]">
                    Railway
                  </p>
                  <StatusBadge result={state.railway} loading={state.railwayLoading} />
                </div>
              </div>

              {/* Error / response details */}
              {(state.vercel?.error || state.railway?.error || state.vercel?.sampleData || state.railway?.sampleData) && (
                <div className="mt-3 space-y-2">
                  {state.vercel?.error && (
                    <div className="rounded-md bg-red-500/5 p-2 text-xs text-red-400">
                      <span className="font-medium">Vercel Error:</span> {state.vercel.error}
                    </div>
                  )}
                  {state.railway?.error && (
                    <div className="rounded-md bg-red-500/5 p-2 text-xs text-red-400">
                      <span className="font-medium">Railway Error:</span> {state.railway.error}
                    </div>
                  )}
                  {state.vercel?.sampleData && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        Vercel Response Preview
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-[var(--muted)] p-2 text-[var(--muted-foreground)]">
                        {state.vercel.sampleData}
                      </pre>
                    </details>
                  )}
                  {state.railway?.sampleData && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        Railway Response Preview
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-[var(--muted)] p-2 text-[var(--muted-foreground)]">
                        {state.railway.sampleData}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
