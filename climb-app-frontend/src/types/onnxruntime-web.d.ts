declare module 'onnxruntime-web' {
  export const env: {
    wasm: {
      simd: boolean;
    };
  };

  export class Tensor<TData extends string = string> {
    constructor(type: TData, data: Float32Array | Int32Array | Uint8Array, dims: readonly number[]);
    type: TData;
    data: Float32Array | Int32Array | Uint8Array;
    dims: readonly number[];
  }

  export interface InferenceSessionOptions {
    executionProviders?: string[];
    graphOptimizationLevel?: string;
  }

  export class InferenceSession {
    static create(modelPath: string, options?: InferenceSessionOptions): Promise<InferenceSession>;
    inputNames: string[];
    outputNames: string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }
}
