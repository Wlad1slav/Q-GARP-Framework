export type QueuePriority = "single" | "sp500";

type QueueTask<T> = {
  id: number;
  priority: QueuePriority;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  started: boolean;
};

type PriorityTaskQueueOptions = {
  concurrency: number;
  minStartIntervalMs?: number;
};

export type QueuedTask<T> = {
  promise: Promise<T>;
  setPriority: (priority: QueuePriority) => void;
};

const priorityRank: Record<QueuePriority, number> = {
  single: 0,
  sp500: 1,
};

export class PriorityTaskQueue {
  private activeCount = 0;
  private lastStartAt = 0;
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly concurrency: number;
  private readonly minStartIntervalMs: number;
  private readonly tasks: Array<QueueTask<unknown>> = [];

  constructor(options: PriorityTaskQueueOptions) {
    this.concurrency = Math.max(1, options.concurrency);
    this.minStartIntervalMs = Math.max(0, options.minStartIntervalMs ?? 0);
  }

  enqueue<T>(priority: QueuePriority, run: () => Promise<T>): Promise<T> {
    return this.enqueueWithHandle(priority, run).promise;
  }

  enqueueWithHandle<T>(priority: QueuePriority, run: () => Promise<T>): QueuedTask<T> {
    const task = {} as QueueTask<T>;
    const promise = new Promise<T>((resolve, reject) => {
      task.id = this.nextId;
      task.priority = priority;
      task.run = run;
      task.resolve = resolve;
      task.reject = reject;
      task.started = false;
      this.nextId += 1;
    });

    this.tasks.push(task as QueueTask<unknown>);
    this.schedule();

    return {
      promise,
      setPriority: (nextPriority) => {
        if (task.started) return;
        task.priority = nextPriority;
        this.schedule();
      },
    };
  }

  private schedule() {
    if (this.timer || this.activeCount >= this.concurrency || !this.tasks.length) {
      return;
    }

    const waitMs = Math.max(0, this.minStartIntervalMs - (Date.now() - this.lastStartAt));
    if (waitMs > 0) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.schedule();
      }, waitMs);
      return;
    }

    this.startNext();
    this.schedule();
  }

  private startNext() {
    const index = this.nextTaskIndex();
    if (index < 0) return;

    const task = this.tasks.splice(index, 1)[0];
    task.started = true;
    this.activeCount += 1;
    this.lastStartAt = Date.now();

    Promise.resolve()
      .then(task.run)
      .then(task.resolve, task.reject)
      .finally(() => {
        this.activeCount -= 1;
        this.schedule();
      });
  }

  private nextTaskIndex() {
    let bestIndex = -1;

    for (let index = 0; index < this.tasks.length; index += 1) {
      const task = this.tasks[index];
      const best = bestIndex >= 0 ? this.tasks[bestIndex] : undefined;

      if (!best || priorityRank[task.priority] < priorityRank[best.priority]) {
        bestIndex = index;
        continue;
      }

      if (priorityRank[task.priority] === priorityRank[best.priority] && task.id < best.id) {
        bestIndex = index;
      }
    }

    return bestIndex;
  }
}
