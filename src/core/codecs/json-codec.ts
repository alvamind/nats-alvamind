import { JSONCodec } from 'nats';
import { ICodec } from './i-codec';

export class JsonCodec<T> implements ICodec<T> {
  private codec = JSONCodec();
  encode(data: T): Uint8Array {
    return this.codec.encode(data);
  }
  decode(data: Uint8Array): T {
    return this.codec.decode(data) as T;
  }
}