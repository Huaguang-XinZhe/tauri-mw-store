import { Store } from "@tauri-apps/plugin-store";

export class PersistentAdapter {
  private store: Store | null = null;
  private initPromise: Promise<Store> | null = null;
  private readonly fileName: string;

  constructor(fileName = "multi-window-store.bin") {
    this.fileName = fileName;
    // 不在构造函数中初始化，延迟到实际使用时
  }

  private async ensureStore(): Promise<Store> {
    if (this.store) return this.store;
    if (this.initPromise) return this.initPromise;

    // 延迟初始化：只有在实际需要时才加载 Store
    // 注意：需要在 src-tauri/capabilities/default.json 中添加权限 "store:default"
    this.initPromise = Store.load(this.fileName).then((s) => {
      this.store = s;
      return s;
    });
    return this.initPromise;
  }

  async load(keys: Set<string>): Promise<Record<string, any>> {
    console.log("PersistentAdapter load", keys);
    const store = await this.ensureStore();
    console.log("PersistentAdapter load", store);
    const result: Record<string, any> = {};
    for (const key of keys) {
      const value = await store.get(key);
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
    console.log("PersistentAdapter load", result);
    return result;
  }

  async save(key: string, value: any): Promise<void> {
    const store = await this.ensureStore();
    await store.set(key, value);
    await store.save();
  }

  async remove(key: string): Promise<void> {
    const store = await this.ensureStore();
    await store.delete(key);
    await store.save();
  }

  async clear(): Promise<void> {
    const store = await this.ensureStore();
    await store.clear();
    await store.save();
  }
}

export const persistentAdapter = new PersistentAdapter();
