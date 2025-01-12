import { StringCodec as NatsStringCodec } from 'nats';
import { ICodec } from './i-codec';

export class StringCodec implements ICodec<string> {
  private codec = NatsStringCodec();
  encode(data: string): Uint8Array {
    return this.codec.encode(data);
  }
  decode(data: Uint8Array): string {
    return this.codec.decode(data);
  }
}