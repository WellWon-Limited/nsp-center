import {useEffect,type ReactNode} from 'react';
import './confirm-dialog.css';
/** A confirmation in its own window over the page: Escape or a click outside cancels. Also used by the profile's sign-out. */
export function ConfirmDialog({ title, confirm, children, onConfirm, onCancel, danger = true }: { title: string; confirm: string; children?: ReactNode; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); }; addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [onCancel]);
  return <div className="admin-dialog-backdrop" onClick={onCancel}>
    <div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" onClick={e => e.stopPropagation()}>
      <h2 id="admin-dialog-title">{title}</h2>
      {children}
      <div className="admin-editor-actions"><button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} autoFocus onClick={onConfirm}>{confirm}</button><button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button></div>
    </div>
  </div>;
}
