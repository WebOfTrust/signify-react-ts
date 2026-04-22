export const monoValueSx = {
    fontFamily: 'var(--app-mono-font)',
    letterSpacing: 0,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
} as const;

export const clickablePanelSx = {
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    transition:
        'border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
    '&:hover': {
        borderColor: 'primary.main',
        bgcolor: 'rgba(39, 215, 255, 0.14)',
        boxShadow:
            '0 0 0 1px rgba(39, 215, 255, 0.36), 0 18px 44px rgba(39, 215, 255, 0.14)',
        transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
        outline: '2px solid rgba(39, 215, 255, 0.85)',
        outlineOffset: 2,
    },
} as const;
