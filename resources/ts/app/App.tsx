import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { localDbFetch } from './lib/localDb';
import { projectId, publicAnonKey } from "../utils/supabase/info";
// ── Suppress Figma Make preview-environment prop warnings ─────────────────────
// FGCmp (Figma's inspector wrapper) injects data-fg-* / data-fgid-* props onto
// every component — MUI rejects them. We scan ALL console.error arguments
// because React passes prop names as later format-string args (%s), not arg[0].
;(function suppressFigmaWarnings() {
  if (typeof console === 'undefined') return;
  const shouldSuppress = (...args: unknown[]) => {
    const msg = args.map(a => String(a ?? '')).join(' ');
    return (
      msg.includes('data-fg-') ||
      msg.includes('data-fgid-') ||
      (msg.includes('not supported') && msg.includes('data-'))
    );
  };
  const _err = console.error.bind(console);
  console.error = (...args: unknown[]) => { if (!shouldSuppress(...args)) _err(...args); };
  const _warn = console.warn.bind(console);
  console.warn  = (...args: unknown[]) => { if (!shouldSuppress(...args)) _warn(...args); };
})();
// ─────────────────────────────────────────────────────────────────────────────

// ── Smart Supabase ↔ localStorage Interceptor ─────────────────────────────────
// On startup, probes the Supabase edge function with a /health check (3 s timeout).
// • If reachable  → all HRIS API calls go to Supabase KV (real persistence).
// • If unreachable → falls back to localStorage (zero network noise, fully offline).
// Any runtime 403 / 503 also triggers an immediate switch to localStorage.
// The current mode is exposed as window.__hrisDbMode and broadcast via the
// custom event "hris-db-mode" so React components can display the status.
(function installFetchInterceptor() {
  if ((window as any).__hrisFetchPatched) return;
  (window as any).__hrisFetchPatched = true;
  const _orig = window.fetch.bind(window);

  const HEALTH = `https://${projectId}.supabase.co/functions/v1/make-server-24f1182d/health`;
  const HDRS   = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

  type DbMode = 'supabase' | 'local' | 'checking';
  let mode: DbMode = 'checking';
  let modeResolve!: (m: 'supabase' | 'local') => void;
  const modePromise = new Promise<'supabase' | 'local'>(r => { modeResolve = r; });

  function setMode(m: 'supabase' | 'local') {
    if (mode === m) return;
    mode = m;
    (window as any).__hrisDbMode = m;
    window.dispatchEvent(new CustomEvent('hris-db-mode', { detail: m }));
    modeResolve(m);
  }

  // Health check — non-blocking; runs in background immediately
  ;(async () => {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 3500);
      const res  = await _orig(HEALTH, { headers: HDRS, signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        console.log('%c✅ HRIS: Supabase KV connected', 'color:#1F7A47;font-weight:700');
        setMode('supabase');
        return;
      }
      console.warn(`HRIS: Supabase /health → HTTP ${res.status}. Using localStorage fallback.`);
    } catch {
      console.warn('HRIS: Supabase unreachable (timeout/network). Using localStorage fallback.');
    }
    setMode('local');
  })();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    // Pass non-HRIS requests straight through (auth, images, etc.)
    if (!url.includes('make-server-24f1182d')) return _orig(input, init);

    // Wait for mode if the health check is still running
    const m = mode !== 'checking' ? mode : await modePromise;

    if (m === 'local') return localDbFetch(url, init);

    // ── Supabase path ──────────────────────────────────────────────────────
    try {
      const res = await _orig(input, init);
      // 403 = function deployed but auth blocked; 503 = function down
      if (res.status === 403 || res.status === 503) {
        console.warn(`HRIS: Supabase returned ${res.status} on ${url} → switching to localStorage`);
        setMode('local');
        return localDbFetch(url, init);
      }
      return res;
    } catch (err) {
      console.warn('HRIS: Supabase request failed → localStorage fallback:', err);
      setMode('local');
      return localDbFetch(url, init);
    }
  };
})();
// ─────────────────────────────────────────────────────────────────────────────

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1F7A47',
      light: '#3FA46A',
      dark: '#13522F',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#D9A441',
      light: '#EFC679',
      dark: '#A87718',
      contrastText: '#ffffff',
    },
    success: { main: '#2E8B57' },
    info: { main: '#2F8F8B' },
    warning: { main: '#D9A441' },
    error: { main: '#B73E2D' },
    background: {
      default: '#F2F7F3',
      paper: '#ffffff',
    },
    text: {
      primary: '#13261A',
      secondary: '#54705F',
    },
    divider: 'rgba(31, 122, 71, 0.12)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(90deg, #0F4F2C 0%, #1F7A47 60%, #2EA163 100%)',
          boxShadow: '0 4px 20px rgba(31,122,71,0.18)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 6px 24px rgba(15,23,42,0.06)',
          border: '1px solid rgba(31,122,71,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 18 },
        containedPrimary: {
          backgroundImage: 'linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)',
          boxShadow: '0 6px 16px rgba(31,122,71,0.28)',
          '&:hover': {
            backgroundImage: 'linear-gradient(135deg, #13522F 0%, #1F7A47 100%)',
            boxShadow: '0 8px 22px rgba(31,122,71,0.4)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#F6FBF7',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#3FA46A' },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1F7A47',
            borderWidth: '2px',
          },
          '&.Mui-disabled': {
            backgroundColor: '#F0F4F1',
          },
        },
        notchedOutline: {
          borderColor: 'rgba(31,122,71,0.28)',
          transition: 'border-color 0.2s ease',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'linear-gradient(180deg, #0F4F2C 0%, #1F7A47 100%)',
          color: '#E6F2EA',
          borderRight: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginInline: 10,
          marginBlock: 2,
          color: 'inherit',
          '& .MuiListItemIcon-root': { color: 'rgba(230,242,234,0.85)', minWidth: 40 },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(217,164,65,0.20)',
            color: '#F5D38A',
            '& .MuiListItemIcon-root': { color: '#EFC679' },
            '&:hover': { backgroundColor: 'rgba(217,164,65,0.28)' },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 400,
          lineHeight: '1.4375em',
          color: '#54705F',
          '&.Mui-focused': {
            color: '#1F7A47',
            fontWeight: 500,
          },
        },
        shrink: {
          transformOrigin: 'top left',
          fontWeight: 500,
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        displayEmpty: true,
      },
      styleOverrides: {
        icon: {
          color: '#1F7A47',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          right: 12,
        },
        select: {
          '&:focus': { backgroundColor: 'transparent' },
        },
      },
    },
    MuiMenu: {
      defaultProps: {
        transitionDuration: 180,
        elevation: 0,
      },
      styleOverrides: {
        paper: {
          borderRadius: '14px !important',
          border: '1px solid rgba(31,122,71,0.16)',
          boxShadow: '0 8px 32px rgba(15,79,44,0.15), 0 2px 8px rgba(15,79,44,0.08)',
          marginTop: '4px',
          minWidth: '180px',
        },
        list: {
          padding: '6px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.925rem',
          fontWeight: 400,
          minHeight: 40,
          margin: '1px 0',
          padding: '8px 12px',
          color: '#13261A',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(31,122,71,0.07)',
            color: '#1F7A47',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(31,122,71,0.11)',
            fontWeight: 600,
            color: '#1F7A47',
            '&:hover': {
              backgroundColor: 'rgba(31,122,71,0.17)',
            },
          },
          '&.Mui-disabled': {
            opacity: 0.5,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          lineHeight: '1.4375em',
        },
        input: {
          fontSize: '1rem',
          fontWeight: 400,
          lineHeight: '1.4375em',
          '&::placeholder': { opacity: 0.6 },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.75rem', lineHeight: 1.66 },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        asterisk: {
          display: 'none',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        // Override the global h1-h4 line-height from theme.css
        h4: { fontSize: '2.125rem', lineHeight: 1.235 },
        h5: { fontSize: '1.5rem',   lineHeight: 1.334 },
        h6: { fontSize: '1.25rem',  lineHeight: 1.6   },
        body1: { fontSize: '1rem',     lineHeight: 1.5  },
        body2: { fontSize: '0.875rem', lineHeight: 1.43 },
        caption: { fontSize: '0.75rem', lineHeight: 1.66 },
      },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}