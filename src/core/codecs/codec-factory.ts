// nats-alvamind/src/core/codecs/codec-factory.ts
import { ICodec } from './i-codec';
import { JsonCodec } from './json-codec';
import { StringCodec } from './string-codec';

export class CodecFactory {
  static create<T>(type: 'json' | 'string'): ICodec<T> {
    switch (type) {
      case 'json':
        return new JsonCodec<T>();
      case 'string':
        return new StringCodec() as ICodec<any>;
      default:
        throw new Error(`Unsupported codec type: ${type}`);
    }
  }
}
