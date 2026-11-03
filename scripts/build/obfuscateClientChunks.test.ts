import { describe, expect, it } from 'vitest';

import { shouldObfuscateChunk } from './obfuscationOptions';

describe('shouldObfuscateChunk', () => {
  it('nimmt einen Chunk mit eigener Planungslogik', () => {
    expect(shouldObfuscateChunk('function a(){return "camp-logic-sentinel:route"}')).toBe(true);
  });

  it('lässt Vendor-Chunks stehen, auch wenn ein Sentinel daneben liegt', () => {
    expect(shouldObfuscateChunk('camp-logic-sentinel:route org.eclipse.elk')).toBe(false);
    expect(shouldObfuscateChunk('camp-logic-sentinel:electrical react-dom')).toBe(false);
    expect(shouldObfuscateChunk('camp-logic-sentinel:verify next/dist/client')).toBe(false);
    expect(shouldObfuscateChunk('camp-logic-sentinel:autowire graphlib.Graph')).toBe(false);
  });

  it('ignoriert Chunks ohne Sentinel', () => {
    expect(shouldObfuscateChunk('function add(a,b){return a+b}')).toBe(false);
  });
});
