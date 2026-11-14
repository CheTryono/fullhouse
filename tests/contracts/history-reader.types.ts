import { createReader } from '../../history/reader.cjs';
import type { Adapter } from '../../history/adapter.cjs';
import type { DocumentV2 } from '../../contracts/history-v2';
declare const adapter: Adapter, document: DocumentV2;
const reader = createReader((_value: unknown) => true, adapter);
const view = reader.read(document, 'event@2030-01-07');
if (view.kind === 'historical') {
  const total: number | null = view.progress.total;
  // @ts-expect-error Las vistas no pueden alterar las capturas leídas.
  view.plan.title = 'Changed';
  void total;
}
if (view.kind === 'incomplete') {
  // @ts-expect-error Un registro incompleto no ofrece un árbol histórico verificable.
  view.tree;
}
