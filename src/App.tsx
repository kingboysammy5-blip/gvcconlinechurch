/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicSite } from './components/public/PublicSite';
import { SanctuaryGame } from './components/public/SanctuaryGame';
import { TestimoniesPage } from './components/public/TestimoniesPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { GVCC_DEFAULT_BOOTSTRAP } from './data/gvccDefaultBootstrap';
import { PublicBootstrap } from './types/church';

function ChurchPlatformApp() {
  const [view, setView] = useState<'public' | 'testimonies' | 'game' | 'admin'>(() => {
    if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    if (
      window.location.hash === '#testimonies' ||
      window.location.pathname.startsWith('/testimonies')
    ) {
      return 'testimonies';
    }
    if (window.location.hash === '#game' || window.location.pathname.startsWith('/game')) {
      return 'game';
    }
    return 'public';
  });
  const [data, setData] = useState<PublicBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBootstrap = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/public/bootstrap');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setData(GVCC_DEFAULT_BOOTSTRAP);
        return;
      }
      const json: PublicBootstrap = await res.json();
      setData(json);
    } catch {
      setData((prev) => prev || GVCC_DEFAULT_BOOTSTRAP);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#admin') setView('admin');
      else if (window.location.hash === '#testimonies') setView('testimonies');
      else if (window.location.hash === '#game') setView('game');
      else if (view !== 'public' && (!window.location.hash || window.location.hash === '#home')) {
        setView('public');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [view]);

  const openAdmin = () => {
    if (window.location.hash !== '#admin') {
      history.pushState(null, '', '#admin');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setView('admin');
  };

  const openTestimonies = () => {
    if (window.location.hash !== '#testimonies') {
      history.pushState(null, '', '#testimonies');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setView('testimonies');
  };

  const openGame = () => {
    if (window.location.hash !== '#game') {
      history.pushState(null, '', '#game');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setView('game');
  };

  const backToSite = () => {
    if (
      window.location.hash === '#admin' ||
      window.location.hash === '#testimonies' ||
      window.location.hash === '#game'
    ) {
      history.replaceState(null, '', '#home');
    }
    setView('public');
    loadBootstrap();
  };

  if (view === 'admin') {
    return (
      <AdminDashboard
        onBackToSite={backToSite}
        onDataChanged={loadBootstrap}
      />
    );
  }

  if (view === 'game') {
    return <SanctuaryGame onBackToSite={backToSite} />;
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#141210] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="font-serif text-2xl sm:text-3xl tracking-tight mb-2">
          Gracious Voice Celebration Centre
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-[#E2C28B]">
          Ogembo, Kenya
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="font-serif text-3xl font-medium">Gracious Voice Celebration Centre</h1>
        <p className="text-sm text-stone-600 max-w-md">
          {error || 'Temporary connection issue while loading church records.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadBootstrap();
          }}
          className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (view === 'testimonies') {
    return (
      <TestimoniesPage
        testimonies={data.testimonies || []}
        fellowships={data.fellowships || []}
        settings={data.settings}
        onBackToSite={backToSite}
        onOpenAdmin={openAdmin}
      />
    );
  }

  return (
    <PublicSite
      data={data}
      onOpenAdmin={openAdmin}
      onOpenTestimonies={openTestimonies}
      onOpenGame={openGame}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChurchPlatformApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
