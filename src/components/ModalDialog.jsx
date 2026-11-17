import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible native <dialog> modal wrapper following modern web standards:
 * - Opens via showModal() for top-layer, Esc dismissal, and inert background
 * - Supports closedby="any" with pointer-geometry fallback for browsers lacking closedBy
 * - Resets returnValue on close to avoid stale values
 */
export default function ModalDialog({
  open,
  onClose,
  titleId,
  title,
  subtitle,
  maxWidth = '38rem',
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleClose = () => {
      dialog.returnValue = '';
      if (onClose) onClose();
    };
    dialog.addEventListener('close', handleClose);

    // Mandatory fallback for browsers without native <dialog closedby="any">
    let cleanupFallback = () => {};
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const onPointerDown = (e) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupFallback();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      closedby="any"
      aria-labelledby={titleId}
      style={{ '--dialog-max-width': maxWidth }}
    >
      <div className="dialog-surface">
        <header className="dialog-header">
          <div className="dialog-heading-group">
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {subtitle ? <p className="dialog-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => dialogRef.current?.close()}
            aria-label="Chiudi finestra"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
