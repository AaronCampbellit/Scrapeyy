import type { Repository } from "../contracts/models";

export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

export function createSettingsRepository<T extends { id: string }>(
  area: StorageArea,
  key: string,
): Repository<T> {
  const read = async (): Promise<T[]> => {
    const result = await area.get(key);
    return Array.isArray(result[key]) ? (result[key] as T[]) : [];
  };
  const write = async (values: T[]): Promise<void> => {
    await area.set({ [key]: values });
  };
  return {
    list: read,
    async get(id) {
      return (await read()).find((value) => value.id === id);
    },
    async put(value) {
      const values = await read();
      const existing = values.findIndex((candidate) => candidate.id === value.id);
      if (existing === -1) {
        values.push(value);
      } else {
        values[existing] = value;
      }
      await write(values);
    },
    async remove(id) {
      await write((await read()).filter((value) => value.id !== id));
    },
  };
}
