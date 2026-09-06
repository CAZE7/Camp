declare module 'elkjs' {
  type ElkNode = {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkNode[];
    edges?: ElkNode[];
    sections?: Array<{
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      bendPoints?: Array<{ x: number; y: number }>;
    }>;
  };
  type ElkOptions = Record<string, string>;
  type ElkLayoutInput = {
    id: string;
    layoutOptions?: ElkOptions;
    children?: ElkNode[];
    edges?: ElkNode[];
  };
  class ELK {
    layout(input: ElkLayoutInput): Promise<ElkNode>;
  }
  export default ELK;
}
