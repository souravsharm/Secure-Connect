import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  AppBar, Toolbar, Typography, Container, Paper, Stack, Box, Divider,
  Select, MenuItem, FormControl, InputLabel, Button, TextField, Chip,
  CssBaseline,
  useMediaQuery,
  Grid
} from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import Editor from '@monaco-editor/react';
import axios from 'axios';

// Tailwind/shadcn theme helper
function getInitialThemeSetting() {
  try {
    return localStorage.getItem('secure_connect_ui_theme') || 'system';
  } catch {
    return 'system';
  }
}

const endpoints = [
  {
    id: 'login',
    label: 'POST /api/v1/auth/login',
    method: 'POST',
    path: '/api/v1/auth/login',
    minimalBody: {
      username: 'admin',
      password: 'ChangeMe123!'
    },
    notes: [
      'Public endpoint — no token required.',
      'On success, the returned token is auto-filled into the JWT Token field below for use on protected endpoints.'
    ]
  },
  {
    id: 'create_cardholder',
    label: 'POST /api/v1/create_cardholder',
    method: 'POST',
    path: '/api/v1/create_cardholder',
    minimalBody: {
      person: {
        firstName: 'John',
        cards: [
          {
            cardType: 'Access',
            cardNumber: 'ABC123',
            activationDate: '2023-07-25T00:00:00Z',
            expiryDate: '2027-09-25T00:00:00Z'
          },
          {
            cardType: 'MSIC',
            cardNumber: 'XYZ789',
            activationDate: '2023-07-25T00:00:00Z',
            expiryDate: '2027-09-25T00:00:00Z'
          }
        ]
      }
    },
    notes: [
      'Minimal required: person.firstName and person.cards (>=1).',
      'Each card requires: cardType (Access|MSIC), cardNumber (6-9 alphanumeric), activationDate (ISO), expiryDate (ISO, after activation).'
    ]
  },
  {
    id: 'update_cardholder',
    label: 'PATCH /api/v1/update_cardholder',
    method: 'PATCH',
    path: '/api/v1/update_cardholder',
    minimalBody: {
      person: {
        firstName: 'John',
        cards: [
          {
            cardType: 'Access',
            cardNumber: 'ABC123',
            activationDate: '2023-07-25T00:00:00Z',
            expiryDate: '2027-09-25T00:00:00Z'
          }
        ]
      },
      type: 'Active'
    },
    notes: [
      'Minimal required to target: person.firstName.',
      'Optional: type to update Access card status; payload fields present will be updated.'
    ]
  },
  {
    id: 'delete_cardholder',
    label: 'DELETE /api/v1/delete_cardholder',
    method: 'DELETE',
    path: '/api/v1/delete_cardholder',
    minimalBody: {
      person: {
        firstName: 'John',
        cards: [
          {
            cardType: 'Access',
            cardNumber: 'ABC123',
            activationDate: '2023-07-25T00:00:00Z',
            expiryDate: '2027-09-25T00:00:00Z'
          }
        ]
      }
    },
    notes: [
      'Minimal required: person.firstName (used to find the cardholder).'
    ]
  },
  {
    id: 'cache_status',
    label: 'GET /api/v1/cache_status',
    method: 'GET',
    path: '/api/v1/cache_status',
    minimalBody: null,
    notes: ['No body. Call root / first to warm cache if needed.']
  },
  {
    id: 'clear_cache',
    label: 'POST /api/v1/clear_cache',
    method: 'POST',
    path: '/api/v1/clear_cache',
    minimalBody: {},
    notes: ['No fields required.']
  },
  {
    id: 'cached_hrefs',
    label: 'GET /api/v1/cached_hrefs',
    method: 'GET',
    path: '/api/v1/cached_hrefs',
    minimalBody: null,
    notes: ['No body. Requires cache initialized.']
  }
];

export default function App() {
  const [endpointId, setEndpointId] = useState(endpoints[0].id);
  const selected = useMemo(() => endpoints.find(e => e.id === endpointId), [endpointId]);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(selected.minimalBody, null, 2));
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [clientCertNote] = useState('Browser cannot present client certificates; run the backend to talk to Gallagher.');
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [themeSetting, setThemeSetting] = useState(getInitialThemeSetting()); // 'light' | 'dark' | 'system'
  const resolvedMode = themeSetting === 'system' ? (prefersDark ? 'dark' : 'light') : themeSetting;

  useEffect(() => {
    try { localStorage.setItem('secure_connect_ui_theme', themeSetting); } catch {}
  }, [themeSetting]);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, [resolvedMode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: resolvedMode,
      primary: { main: resolvedMode === 'dark' ? '#60a5fa' : '#2563eb' },
      secondary: { main: resolvedMode === 'dark' ? '#93c5fd' : '#3b82f6' },
      ...(resolvedMode === 'dark'
        ? {
            background: { default: '#0b1220', paper: 'rgba(17, 24, 39, 0.92)' },
            text: { primary: '#e5e7eb', secondary: '#cbd5e1' }
          }
        : {
            background: { default: '#f5f7fb', paper: '#ffffff' },
            text: { primary: '#0f172a', secondary: '#475569' }
          })
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: `'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif`,
      h1: { fontFamily: `'Playfair Display', serif` },
      h2: { fontFamily: `'Playfair Display', serif` },
      h3: { fontFamily: `'Playfair Display', serif` },
      h4: { fontFamily: `'Playfair Display', serif` },
      h5: { fontFamily: `'Playfair Display', serif` },
      h6: { fontFamily: `'Playfair Display', serif` }
    }
  }), [resolvedMode]);

  const backgroundDecor = useMemo(() => 'none', []);

  // Remember API base URL and token between sessions for convenience
  useEffect(() => {
    try {
      const mem = JSON.parse(localStorage.getItem('secure_connect_ui_prefs') || '{}');
      if (mem.apiBaseUrl) setApiBaseUrl(mem.apiBaseUrl);
      if (mem.authToken) setAuthToken(mem.authToken);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('secure_connect_ui_prefs', JSON.stringify({ apiBaseUrl, authToken }));
    } catch {}
  }, [apiBaseUrl, authToken]);

  const handleEndpointChange = (e) => {
    const id = e.target.value;
    setEndpointId(id);
    const ep = endpoints.find(x => x.id === id);
    setJsonValue(ep.minimalBody != null ? JSON.stringify(ep.minimalBody, null, 2) : '');
    setResponseText('');
  };

  const sendRequest = async () => {
    setLoading(true);
    setResponseText('');
    try {
      const url = (apiBaseUrl?.trim()) ? `${apiBaseUrl}${selected.path}` : selected.path;
      const headers = {};
      if (selected.id !== 'login' && authToken?.trim()) {
        headers['Authorization'] = `Bearer ${authToken.trim()}`;
      }
      headers['X-Correlation-Id'] = cryptoRandomId();

      const config = { url, method: selected.method, headers };
      if (selected.method !== 'GET') {
        config.data = jsonValue?.trim() ? JSON.parse(jsonValue) : undefined;
      }
      const res = await axios(config);
      setResponseText(JSON.stringify(res.data, null, 2));
      if (selected.id === 'login' && res.data?.token) {
        setAuthToken(res.data.token);
      }
    } catch (err) {
      const payload = err.response ? { status: err.response.status, data: err.response.data } : { message: err.message };
      setResponseText(JSON.stringify(payload, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Background */}
      <Box className="min-h-screen text-foreground" sx={{
        minHeight: '100vh',
        background: backgroundDecor
      }}>
        {/* Top bar */}
        <AppBar position="static" elevation={0} sx={{
          background: resolvedMode === 'dark' ? 'rgba(2,6,23,0.6)' : 'rgba(255,255,255,0.75)',
          backdropFilter: 'saturate(140%) blur(10px)',
          borderBottom: resolvedMode === 'dark' ? '1px solid rgba(148,163,184,0.15)' : '1px solid rgba(2,6,23,0.06)'
        }}>
          <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ flex: 1 }} />
            <Typography variant="h6" sx={{ letterSpacing: 0.2, fontWeight: 600, textAlign: 'center' }}>
              Secure Connect — API Console
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Chip label="Material UI + Monaco" variant="outlined" sx={{ borderColor: 'primary.main', color: 'primary.main' }} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="theme-label">Theme</InputLabel>
                <Select
                  labelId="theme-label"
                  label="Theme"
                  value={themeSetting}
                  onChange={(e) => setThemeSetting(e.target.value)}
                >
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Request</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id="endpoint-label">Endpoint</InputLabel>
                      <Select labelId="endpoint-label" label="Endpoint" value={endpointId} onChange={handleEndpointChange}>
                        {endpoints.map(e => (
                          <MenuItem key={e.id} value={e.id}>{e.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                  <TextField fullWidth label="API Base URL (optional)" placeholder="http://localhost:3000" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
                  <TextField fullWidth label="JWT Token" placeholder="obtained from POST /api/v1/auth/login" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />

                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Minimal body expectations</Typography>
                    <Stack spacing={0.5}>
                      {selected.notes?.map((n, i) => (
                        <Typography key={i} variant="body2">• {n}</Typography>
                      ))}
                    </Stack>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Button variant="contained" onClick={sendRequest} disabled={loading}>{loading ? 'Sending…' : 'Send'}</Button>
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                      {selected.id === 'login'
                        ? 'This request is public and requires no Authorization header.'
                        : `Authorization header will be: Bearer ${authToken ? '******' : '(none — call /auth/login first)'}`}
                    </Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">{clientCertNote}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={3}>
                {selected.method !== 'GET' && (
                  <Paper sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="subtitle1" gutterBottom>Request JSON</Typography>
                    <Editor
                      height="340px"
                      theme={resolvedMode === 'dark' ? 'vs-dark' : 'light'}
                      defaultLanguage="json"
                      value={jsonValue}
                      onChange={(v) => setJsonValue(v ?? '')}
                      options={{ minimap: { enabled: false }, fontSize: 14, fontLigatures: true, roundedSelection: true }}
                    />
                  </Paper>
                )}
                <Paper sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography variant="subtitle1" gutterBottom>Response</Typography>
                  <Editor
                    height="340px"
                    theme={resolvedMode === 'dark' ? 'vs-dark' : 'light'}
                    defaultLanguage="json"
                    value={responseText}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }}
                  />
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

function cryptoRandomId() {
  // Basic random string; browsers with crypto available should use it
  if (window.crypto?.getRandomValues) {
    const arr = new Uint32Array(4);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(n => n.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}