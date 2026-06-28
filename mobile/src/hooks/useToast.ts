import { useState, useCallback } from 'react';

export function useToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  const hideToast = useCallback(() => setVisible(false), []);

  return { toastVisible: visible, toastMessage: message, showToast, hideToast };
}
