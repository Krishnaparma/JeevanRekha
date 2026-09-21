/**
 * Binary min-heap priority queue.
 *
 * This is the engine behind the two core methods of the app:
 *  1. Dijkstra's shortest path over the road-network graph (fringe ordered by
 *     tentative travel time).
 *  2. Ranking candidate hospitals (ordered by ETA, then distance, then
 *     available beds) so the top of the queue is always the suggestion.
 *
 * The heap keeps an operation counter so the UI can show the algorithmic cost
 * of every query.
 */
export type Comparator<T> = (a: T, b: T) => number;

export class MinHeap<T> {
  private readonly heap: T[] = [];
  private readonly compare: Comparator<T>;

  /** number of push() calls */
  pushes = 0;
  /** number of pop() calls that returned an element */
  pops = 0;
  /** number of element swaps performed while heapifying */
  swaps = 0;

  constructor(compare?: Comparator<T>) {
    this.compare = compare ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  push(value: T): void {
    this.pushes += 1;
    this.heap.push(value);
    this.siftUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    this.pops += 1;
    const top = this.heap[0] as T;
    const last = this.heap.pop() as T;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Drains the queue in ascending priority order. */
  drain(): T[] {
    const out: T[] = [];
    while (!this.isEmpty()) out.push(this.pop() as T);
    return out;
  }

  toArray(): T[] {
    return [...this.heap];
  }

  clear(): void {
    this.heap.length = 0;
  }

  get stats() {
    return { pushes: this.pushes, pops: this.pops, swaps: this.swaps };
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i] as T, this.heap[parent] as T) < 0) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  private siftDown(index: number): void {
    const n = this.heap.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.compare(this.heap[left] as T, this.heap[smallest] as T) < 0) {
        smallest = left;
      }
      if (right < n && this.compare(this.heap[right] as T, this.heap[smallest] as T) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    this.swaps += 1;
    const tmp = this.heap[a] as T;
    this.heap[a] = this.heap[b] as T;
    this.heap[b] = tmp;
  }
}

/** Ordering helper used by the hospital ranking queue. */
export function byNumber(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
