import React, { useEffect, useRef } from 'react';

interface TurnstileInstance {
  render: (element: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
    theme?: 'auto' | 'dark' | 'light';
    size?: 'normal' | 'compact';
  }) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

interface Props {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey: number;
}

// Site key is public. Never put the Turnstile secret key in frontend code.
const TurnstileCaptcha: React.FC<Props> = ({ siteKey, onToken, resetKey }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'normal',
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    };
    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-rentovio-turnstile]');
      if (existing) {
        existing.addEventListener('load', render);
        script = existing;
      } else {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.rentovioTurnstile = 'true';
        script.addEventListener('load', render);
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      script?.removeEventListener('load', render);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  // Cloudflare's normal widget is 300x65px. Scale it to fit the 258px-wide
  // login form without the tall, narrow compact widget.
  return (
    <div className="flex h-[52px] w-full min-w-0 justify-center overflow-hidden">
      <div className="h-[65px] w-[300px] shrink-0 origin-top scale-[0.78]">
        <div ref={containerRef} aria-label="Έλεγχος ασφαλείας CAPTCHA" />
      </div>
    </div>
  );
};

export default TurnstileCaptcha;
