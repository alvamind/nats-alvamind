export type MessageHandler<T> = (err: Error | null, payload: T | null) => Promise<void> | void;
