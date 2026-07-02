import { useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { ProductListPage } from './ProductListPage';
import { ProductsPage } from './ProductsPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

type ProductEditorRequest =
  | { mode: 'new' }
  | { mode: 'edit'; id: number };

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

export function ProductsSection({ selectedCompanyId, selectedLocationIds }: Props) {
  const [tab, setTab] = useState<'list' | 'editor'>('list');
  const [editorRequest, setEditorRequest] = useState<ProductEditorRequest | null>(null);

  function openEditor(request: ProductEditorRequest) {
    setEditorRequest(request);
    setTab('editor');
  }

  const tabLabels = { list: 'Product List', editor: 'Product' } as const;
  useRevMgmtPageLabel(tabLabels[tab]);

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'list' as const, label: 'Product List' },
          { id: 'editor' as const, label: 'Product' },
        ]).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === item.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        <ProductListPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          onCreateProduct={() => openEditor({ mode: 'new' })}
          onEditProduct={id => openEditor({ mode: 'edit', id })}
        />
      ) : (
        <ProductsPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          editorRequest={editorRequest}
          onEditorRequestConsumed={() => setEditorRequest(null)}
          onClose={() => setTab('list')}
        />
      )}
    </div>
  );
}
