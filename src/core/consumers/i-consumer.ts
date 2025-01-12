export interface IConsumer {
  consume(): Promise<void>;
  stop(): Promise<void>;
}