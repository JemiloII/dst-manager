import { useEffect, useState } from 'react';
import './Modal.scss';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footerJSX?: React.ReactNode;
  className?: string;
}

export default function Modal({
  isOpen = false,
  onClose = () => {},
  title = '',
  children,
  footerJSX,
  className = '',
}: ModalProps) {
  const [isInnerOpen, setIsInnerOpen] = useState(isOpen);

  useEffect(() => {
    setIsInnerOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isInnerOpen) {
        onClose();
      }
    };

    if (isInnerOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isInnerOpen, onClose]);

  const closeModal = () => {
    setIsInnerOpen(false);
    onClose();
  };

  if (!isInnerOpen) return null;

  return (
    <div className={`Modal ${className} Modal--open`} onClick={closeModal}>
      <div className="Modal__content" onClick={(e) => e.stopPropagation()}>
        {title && (
          <header className="Modal__header">
            <h2>{title}</h2>
            <span
              role="button"
              className="Modal__close"
              onClick={closeModal}
              aria-label="Close modal"
            >
              &times;
            </span>
          </header>
        )}
        
        <div className="Modal__body">
          {children}
        </div>
        
        {footerJSX && (
          <footer className="Modal__footer">
            {footerJSX}
          </footer>
        )}
      </div>
    </div>
  );
}