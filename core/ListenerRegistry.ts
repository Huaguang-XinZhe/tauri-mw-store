type Listener = (value: any) => void;

class ListenerRegistryClass {
  private listeners: Map<string, Set<Listener>> = new Map();

  public addListener(key: string, callback: Listener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => this.removeListener(key, callback); // return unsubscribe fn
  }

  public removeListener(key: string, callback: Listener) {
    this.listeners.get(key)?.delete(callback);
  }

  public notify(key: string, value: any) {
    this.listeners.get(key)?.forEach((listener) => listener(value));
  }
}

export const ListenerRegistry = new ListenerRegistryClass();
