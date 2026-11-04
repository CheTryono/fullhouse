declare namespace React {
  class Component<P = {}, S = {}> {
    props: P;
    state: S;
    constructor(props: P);
    setState(state: Partial<S> | ((state: S) => Partial<S>)): void;
  }
  function createElement(type: any, props?: any, ...children: any[]): any;
}
declare const ReactDOM: { render(element: any, target: Element | null): void };
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
}