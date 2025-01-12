export interface MessageBrokerConfig {
  url: string;
  streamName: string;
  subjects: string[];
  consumerName: string;
}