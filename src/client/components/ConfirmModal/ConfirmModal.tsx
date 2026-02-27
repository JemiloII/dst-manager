import { memo, useEffect, useRef } from 'react';
import Modal from '../Modal';
import './ConfirmModal.scss';

interface ConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  body?: string;
}

function ConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
  title = 'Are You Sure?',
  body = 'Are you sure you want to proceed?',
}: ConfirmModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
    >
      <div className="ConfirmModal__content">
        <p className="ConfirmModal__disclaimer">{body}</p>
        <div className="ConfirmModal__buttons">
          <button
            ref={buttonRef}
            className="ConfirmModal__confirm"
            type="button"
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button
            className="ConfirmModal__cancel"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(ConfirmModal);