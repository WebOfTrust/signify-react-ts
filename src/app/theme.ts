import { createTheme } from '@mui/material/styles';

const graphite = {
    abyss: '#05090d',
    deck: '#091018',
    panel: '#0d1722',
    panelHigh: '#132334',
    line: '#234055',
    lineStrong: '#3a6680',
    text: '#e7f4ff',
    muted: '#8aa1b2',
    dim: '#5f7380',
    cyan: '#27d7ff',
    blue: '#2487ff',
    amber: '#ffb02e',
    green: '#39d47a',
    red: '#ff3d4f',
    violet: '#a778ff',
};

export const appTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: graphite.cyan,
            light: '#76e8ff',
            dark: '#008bb8',
            contrastText: '#041016',
        },
        secondary: {
            main: graphite.violet,
            light: '#c5a8ff',
            dark: '#7450c7',
            contrastText: '#ffffff',
        },
        success: {
            main: graphite.green,
            dark: '#18a955',
            contrastText: '#041016',
        },
        warning: {
            main: graphite.amber,
            dark: '#c67b00',
            contrastText: '#05090d',
        },
        error: {
            main: graphite.red,
            dark: '#ba1628',
            contrastText: '#ffffff',
        },
        info: {
            main: graphite.blue,
            dark: '#0063cc',
            contrastText: '#ffffff',
        },
        background: {
            default: graphite.abyss,
            paper: graphite.panel,
        },
        text: {
            primary: graphite.text,
            secondary: graphite.muted,
            disabled: graphite.dim,
        },
        divider: graphite.line,
        action: {
            active: graphite.cyan,
            hover: 'rgba(39, 215, 255, 0.09)',
            selected: 'rgba(39, 215, 255, 0.16)',
            disabled: 'rgba(138, 161, 178, 0.38)',
            disabledBackground: 'rgba(95, 115, 128, 0.18)',
        },
    },
    shape: {
        borderRadius: 4,
    },
    typography: {
        fontFamily:
            'var(--app-interface-font), Inter, system-ui, Helvetica, Arial, sans-serif',
        h1: { fontWeight: 600, letterSpacing: 0 },
        h2: { fontWeight: 600, letterSpacing: 0 },
        h3: { fontWeight: 600, letterSpacing: 0 },
        h4: { fontWeight: 600, letterSpacing: 0 },
        h5: { fontWeight: 600, letterSpacing: 0 },
        h6: { fontWeight: 600, letterSpacing: 0 },
        button: {
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: 'uppercase',
        },
        caption: {
            letterSpacing: 0,
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: graphite.abyss,
                    backgroundImage:
                        'linear-gradient(rgba(39, 215, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(39, 215, 255, 0.025) 1px, transparent 1px)',
                    backgroundSize: '48px 48px, 48px 48px',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: 'rgba(6, 13, 20, 0.94)',
                    borderBottom: `1px solid ${graphite.lineStrong}`,
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.32)',
                    backdropFilter: 'blur(12px)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: `1px solid ${graphite.line}`,
                    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.32)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: graphite.panel,
                    border: `1px solid ${graphite.line}`,
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: graphite.deck,
                    border: `1px solid ${graphite.lineStrong}`,
                    boxShadow:
                        '0 24px 70px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(118, 232, 255, 0.12)',
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${graphite.line}`,
                    color: graphite.text,
                    paddingTop: 20,
                    paddingBottom: 16,
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    borderTop: `1px solid ${graphite.line}`,
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            variants: [
                {
                    props: { variant: 'contained', color: 'primary' },
                    style: {
                        background:
                            'linear-gradient(180deg, #37ddff 0%, #1478c7 100%)',
                        boxShadow:
                            'inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 0 18px rgba(39, 215, 255, 0.18)',
                        '&:hover': {
                            background:
                                'linear-gradient(180deg, #78eaff 0%, #198eea 100%)',
                        },
                        '&.Mui-disabled': {
                            background: 'rgba(95, 115, 128, 0.18)',
                            color: 'rgba(138, 161, 178, 0.38)',
                            boxShadow: 'none',
                        },
                    },
                },
            ],
            styleOverrides: {
                root: {
                    borderRadius: 3,
                    minHeight: 40,
                },
                outlined: {
                    borderColor: graphite.lineStrong,
                    color: graphite.text,
                    '&:hover': {
                        borderColor: graphite.cyan,
                        backgroundColor: 'rgba(39, 215, 255, 0.08)',
                    },
                },
                text: {
                    color: graphite.cyan,
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    borderRadius: 3,
                    '&:hover': {
                        backgroundColor: 'rgba(39, 215, 255, 0.1)',
                    },
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                variant: 'outlined',
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(5, 9, 13, 0.68)',
                    borderRadius: 3,
                    '& fieldset': {
                        borderColor: graphite.lineStrong,
                    },
                    '&:hover fieldset': {
                        borderColor: graphite.cyan,
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: graphite.cyan,
                        boxShadow: '0 0 0 1px rgba(39, 215, 255, 0.24)',
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    color: graphite.muted,
                    '&.Mui-focused': {
                        color: graphite.cyan,
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${graphite.line}`,
                },
                head: {
                    color: graphite.muted,
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 3,
                    fontWeight: 700,
                },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundColor: graphite.panel,
                    backgroundImage: 'none',
                    border: `1px solid ${graphite.line}`,
                    boxShadow: 'none',
                    '&:before': {
                        display: 'none',
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#070d14',
                    borderRight: `1px solid ${graphite.lineStrong}`,
                },
            },
        },
        MuiBackdrop: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(0, 0, 0, 0.68)',
                    backdropFilter: 'blur(2px)',
                },
            },
        },
    },
});
