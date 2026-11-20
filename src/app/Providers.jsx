'use client';
import { Suspense } from 'react';
import { StoreProvider, useStore } from '../store/AppStore';
import { ToastProvider } from '../components/ui/Toast';
import { ThemeProvider } from '../store/StyleContext';
import DemoNavigator from '../components/layout/DemoNavigator';
import { Logo } from '../components/layout/Brand';

/** Shown until the visitor's data has loaded from the API (and if the API can't be reached). */
function Gate({ children }) {
  const { status, state, loadError, refresh } = useStore();
  if (status === 'ready') {
    return (
      <>
        {children}
        {state.demo?.login && <DemoNavigator />}
      </>
    );
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-mist-50 px-4 text-center">
      <Logo />
      {status === 'error' ? (
        <div className="max-w-sm">
          <p className="font-semibold text-ink-900">We couldn't load AutoDealer</p>
          <p className="mt-1 text-sm text-mist-600">{loadError}</p>
          <button type="button" className="btn btn-md btn-primary mt-4" onClick={() => refresh().catch(() => {})}>
            Try again
          </button>
        </div>
      ) : (
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-mist-200 border-t-accent-600" role="status" aria-label="Loading" />
      )}
    </div>
  );
}

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <StoreProvider>
          <Gate>
            <Suspense fallback={null}>{children}</Suspense>
          </Gate>
        </StoreProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
