import { makeAutoObservable, observableRef, runInAction } from "mobx";

/** the one async primitive (build/app-state-tree). `run` drops a result that a newer run superseded */
export class Query<T> {
  isRunning = false;
  result: T | undefined = undefined;
  error: Error | undefined = undefined;
  private generation = 0;

  constructor(private fn: () => Promise<T>) {
    makeAutoObservable<Query<T>, "fn" | "generation">(this, {
      result: observableRef,
      error: observableRef,
      fn: false,
      generation: false,
    });
  }

  async run(): Promise<void> {
    const gen = ++this.generation;
    this.isRunning = true;
    this.error = undefined;
    try {
      const r = await this.fn();
      runInAction(() => {
        if (gen !== this.generation) return;
        this.result = r;
        this.isRunning = false;
      });
    } catch (e) {
      runInAction(() => {
        if (gen !== this.generation) return;
        this.error = e instanceof Error ? e : new Error(String(e));
        this.isRunning = false;
      });
    }
  }
}
